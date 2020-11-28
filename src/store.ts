import * as vscode from 'vscode';
import { Favorite, FavoriteKind } from './model';
import { v4 as uuidv4 } from 'uuid';

export type OnStoreLoadedHandler = () => void;

export class FavoriteStore {

    private _onStoreLoaded: vscode.EventEmitter<undefined> = new vscode.EventEmitter();
    /**
     * Event emitted whenever the store is loaded/reloaded and is ready to be used.
     */
    readonly onStoreLoaded: vscode.Event<undefined> = this._onStoreLoaded.event;

    private static _instance: FavoriteStore; // Current store instance
    private _favorites: Favorite[] = []; // In memory collection of Favorites

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
    private constructor(private context: vscode.ExtensionContext, loaded: OnStoreLoadedHandler) {
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
    async refresh():Promise<void> {
        // When loading the favorites from the json file, it can happen that the json is malformed and needs to be fixed.
        // If so immediately after loading the favorites we re-save the corrected data.
        let saveRequired = false;
        const buffer = await vscode.workspace.fs.readFile(this._storeUri);

        this._favorites = (JSON.parse(buffer.toString()) as Favorite[])?.map(f => {
            let fav = Object.assign(new Favorite(), f);
            if (!f.uuid) {
                fav.uuid = uuidv4();
                saveRequired = true;
            }
            if (f.children && f.children.length) {
                fav.children = f.children.map(child => {
                    let c = Object.assign(new Favorite(), child);
                    c.parent = fav.uuid;
                    return c;
                });
            }
            return fav;
        }) || [];

        // We fixed the structure, a save is neede.
        if (saveRequired) {
            await this.persist();
        }

        this._onStoreLoaded.fire(undefined);
    }

    /**
     * Adds a Favorite to the store and notifies all the subscribers of the newly added favorite.
     * No duplication check is performed on addition.
     * @param fav The favorites to add
     */
    public async add(...fav: Favorite[]): Promise<void> {
        this._favorites.push(...fav);
        await this.persist();
    }

    /**
     * Updates an already existing Favorite in the store.
     * @param fav The favorites to update
     */
    public async update(...fav: (Favorite | undefined)[]): Promise<void> {
        await this.persist();
    }

    /**
     * Removes a favorite from the store.
     * @param fav The favorites to add
     */
    public async delete(...fav: Favorite[]): Promise<void> {
        fav.forEach(x => {
            let parent = this.getParent(x);
            if (parent) {
                parent?.removeChild(x);
            } else {
                // No parents, top level favorite
                let index = this._favorites.findIndex(y => y.uuid === x.uuid);
                this._favorites.splice(index, 1);
            }
        });

        await this.persist();
    }

    /**
     * Returns a shallow copy of all the favorites in the store.
     * The returned array is a copy of the underlying storage which contains references to the original Favorites.
     * Any change to a Favorite in this collection followed by a crud operation will commit the changes in the underlying storage.
     * @returns all the Favorites in the store. 
     */
    public favorites(): Favorite[] {
        return this._favorites.sort(Favorite.comparatorFn);
    }

    /**
     * Returns shallow a copy of all the groups in the store
     * The returned array is a copy of the underlying storage which contains references to the original Favorites.
     * Any change to a Favorite in this collection followed by an addition/update operation will commit the changes in the underlying storage.
     * @returns all the Favorites in the store. 
     */
    public groups(): Favorite[] {
        return this._favorites.filter(f => FavoriteKind.Group === f.kind).sort(Favorite.comparatorFn);
    }

    /**
     * @readonly The provided Favorite's parent or undefined if no parents are declared nor found.
     */
    public getParent(fav: Favorite): Favorite | undefined {
        if (!fav.parent) { return undefined; }
        return this._favorites.find(x => x.uuid === fav.parent);
    }

    /**
     * Saves the favorites to the underlying storage
     */
    private persist(): Thenable<void> {
        return vscode.workspace.fs.writeFile(this.storeUri, Buffer.from(JSON.stringify(this._favorites, null, 4)));
    }
}