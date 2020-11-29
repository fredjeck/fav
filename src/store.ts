import * as vscode from 'vscode';
import { Bookmarkable, bookmarkableComparator, Favorite, Group, isGroup } from './model';
import { v4 as uuidv4 } from 'uuid';

export type OnStoreLoadedHandler = () => void;

export class FavoriteStore {

    private _onStoreLoaded: vscode.EventEmitter<undefined> = new vscode.EventEmitter();
    /**
     * Event emitted whenever the store is loaded/reloaded and is ready to be used.
     */
    readonly onStoreLoaded: vscode.Event<undefined> = this._onStoreLoaded.event;

    private static _instance: FavoriteStore; // Current store instance

    private _favorites: Bookmarkable[] = []; // In memory collection of Favorites
    private _saveRequired = false; // When true, means that fixes have been made while loading favorites, and that the result should be saved 

    private _storeUri: vscode.Uri;
    get storeUri(): vscode.Uri {
        return this._storeUri;
    }

    static get instance() {
        if (!FavoriteStore._instance) {
            throw new Error('Favorites store has not been initialized');
        }
        return FavoriteStore._instance;
    }

    /**
     * Instantiates the store, cannot be called directly.
     * A store instance should be obtained via the load method for an initial call() and via the current() method for any subsequent calls.
     * @param context The extension context we are running in
     */
    private constructor(context: vscode.ExtensionContext, loaded: OnStoreLoadedHandler) {
        var globalStorageUri = context.globalStorageUri;
        vscode.workspace.fs.createDirectory(globalStorageUri);
        this._storeUri = vscode.Uri.joinPath(globalStorageUri, 'favorites.json');
        this.onStoreLoaded(loaded);
        this.refresh();
    };

    /**
     * Initializes the store, if already initialized, returns the already configured instance instead.
     * @param context The extension context we are running in
     * @returns The store instance
     */
    static fromContext(context: vscode.ExtensionContext, loaded: OnStoreLoadedHandler): FavoriteStore {
        if (!FavoriteStore._instance) {
            FavoriteStore._instance = new FavoriteStore(context, loaded);
        }
        return FavoriteStore._instance;
    }

    /**
     * Reloads the store from the underlying storage.
     * Missing UUIDS and parent IDs will be automatically filled upon loading.
     * @emits onStoreLoaded
     */
    async refresh(): Promise<void> {
        // When loading the favorites from the json file, it can happen that the json is malformed and needs to be fixed.
        // If so immediately after loading the favorites we re-save the corrected data.
        let saveRequired = false;
        const buffer = await vscode.workspace.fs.readFile(this._storeUri);

        this._favorites = (JSON.parse(buffer.toString()) as any[])?.map(f => this.restore(f)) || [];

        // We fixed the structure, a save is neede.
        if (this._saveRequired) {
            await this.persist();
            this._saveRequired = false;
        }

        this._onStoreLoaded.fire(undefined);
    }

    /**
     * Converts obj to its Bookmarkable equivalent
     * @param obj An object to convert from storage to full fledge object
     */
    private restore(obj:any):Bookmarkable{
        if (isGroup(obj)) {
            let group = Object.assign(new Group(), obj);
            if (!obj.uuid) {
                group.uuid = uuidv4();
                this._saveRequired = true;
            }
            group.children = obj.children.map((child:any)=>this.restore(child));
            return group;
        } else {
            let fav = Object.assign(new Favorite(), obj);
            if (!obj.uuid) {
                fav.uuid = uuidv4();
                this._saveRequired = true;
            }
            return fav;
        }
    }

    /**
     * Adds a Bookmarkable to the store.
     * No duplication check is performed on addition.
     * @param bk The favorites to add
     */
    public async add(...bk: Bookmarkable[]): Promise<void> {
        this._favorites.push(...bk);
        this.persist();
    }

    /**
     * Updates an already existing Favorite in the store.
     * @param bk The favorites to update
     */
    public async update(...bk: Bookmarkable[]): Promise<void> {
        await this.persist();
    }

    /**
     * Removes a favorite from the store.
     * @param bk The favorites to add
     */
    public async delete(...bk: Bookmarkable[]): Promise<void> {
        bk.forEach(x => {
            let parent = this.getParent(x);
            if (parent && isGroup(parent)) {
                (parent as Group).removeChild(x);
            } else {
                // No parents, top level favorite
                let index = this._favorites.findIndex(y => y.uuid === x.uuid);
                this._favorites.splice(index, 1);
            }
        });

        await this.persist();
    }

    /**
     * Returns a shallow copy of all the Bookmarkables in the store.
     * The returned array is a copy of the underlying storage which contains references to the original Bookmarkable.
     * Any change to a Bookmarkable in this collection followed by a crud operation will commit the changes in the underlying storage.
     * @returns all the Bookmarkables in the store. 
     */
    public all(): Bookmarkable[] {
        return this._favorites.sort(bookmarkableComparator);
    }

    /**
     * Returns shallow a copy of all the Groups in the store
     * The returned array is a copy of the underlying storage which contains references to the original Groups.
     * Any change to a Group in this collection followed by an addition/update operation will commit the changes in the underlying storage.
     * @returns all the Group in the store. 
     */
    public groups(): Group[] {
        return this._favorites.filter(isGroup).sort(bookmarkableComparator) as Group[];
    }

    /**
     * @readonly The provided Bookmarkable's parent or undefined if no parents are declared nor found.
     */
    public getParent(bk: Bookmarkable): Group | undefined {
        if (!bk.parent) { return undefined; }
        return this._favorites.find(x => x.uuid === bk.parent) as Group;
    }

    /**
     * Saves the favorites to the underlying storage
     */
    private persist(): Thenable<void> {
        return vscode.workspace.fs.writeFile(this.storeUri, Buffer.from(JSON.stringify(this._favorites, null, 4)));
    }
}