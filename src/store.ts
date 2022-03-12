import { chdir } from 'process';
import * as vscode from 'vscode';
import { Bookmarkable, bookmarkableComparator, Favorite, Folder, Group } from './model';

export type OnStoreLoadedHandler = () => void;

export class FavoriteStore {

    private _onStoreLoaded: vscode.EventEmitter<undefined> = new vscode.EventEmitter();
    /**
     * Event emitted whenever the store is loaded/reloaded and is ready to be used.
     */
    readonly onStoreLoaded: vscode.Event<undefined> = this._onStoreLoaded.event;

    private _favorites: Bookmarkable[] = []; // In memory collection of Favorites

    private _storeUri: vscode.Uri;
    get storeUri(): vscode.Uri {
        return this._storeUri;
    }

    private _restoreUri: vscode.Uri;
    get restoreUri(): vscode.Uri {
        return this._restoreUri;
    }

    private static _instance: FavoriteStore; // Current store instance
    /**
     * @returns the current instance of the Favorites store.
     */
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
        this._restoreUri = vscode.Uri.joinPath(globalStorageUri, 'restore.json');
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
        const buffer = await vscode.workspace.fs.readFile(this._storeUri);

        this._favorites = (JSON.parse(buffer.toString()) as any[])?.map(f => this.restore(f)) || [];
        this._onStoreLoaded.fire(undefined);
    }

    /**
     * Converts obj to its Bookmarkable equivalent
     * @param obj An object to convert from storage to full fledge object
     */
    private restore(obj: any, parent?: Bookmarkable): Bookmarkable {
        let bk: Bookmarkable;
        if (Group.isGroup(obj)) {
            bk = Object.assign(new Group(), obj);
            (bk as Group).children = obj.children.map((child: any) => this.restore(child, bk));
        } else if((obj as Folder).filter !== undefined) {
            bk = Object.assign(new Folder(), obj);
        }else{
            bk = Object.assign(new Favorite(), obj);
        }
        if (parent) {
            bk.parent = parent;
        }
        return bk;
    }

    /**
     * Adds a Bookmarkable to the store.
     * No duplication check is performed on addition.
     * @param bk The favorites to add
     */
    async add(...bk: Bookmarkable[]): Promise<void> {
        this._favorites.push(...bk);
        this.persist();
    }

    /**
     * Updates an already existing Favorite in the store.
     * @param bk The favorites to update
     */
    async update(...bk: Bookmarkable[]): Promise<void> {
        await this.persist();
    }

    /**
     * Removes a favorite from the store.
     * @param bk The favorites to add
     */
    async delete(...bk: Bookmarkable[]): Promise<void> {
        bk.forEach(x => {
            if (x.parent && Group.isGroup(x.parent)) {
                (x.parent as Group).removeChild(x);
            } else {
                // No parents, top level favorite
                let index = this._favorites.indexOf(x);
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
    root(): Bookmarkable[] {
        return this._favorites.sort(bookmarkableComparator);
    }

    /**
     * Returns flatened out copy of all the Groups an deep nested groups in the store.
     * The returned array is a copy of the underlying storage which contains references to the original Groups.
     * Any change to a Group in this collection followed by an addition/update operation will commit the changes in the underlying storage.
     * @returns all the Group in the store. 
     */
    groups(): Group[] {
        let groups = this._favorites.filter(Group.isGroup) as Group[];
        let res = groups.flatMap(g => {
            let children = g.groupsDeep([]);
            children.push((g as Group));
            return children;
        });
        return res.sort(bookmarkableComparator) as Group[];
    }

    /**
     * Returns a flatened out list of all the Favorites currently in the store.
     */
    favorites(): Favorite[] {
        let favorites = this._favorites.filter(x => !Group.isGroup(x)) as Favorite[];
        let res = this._favorites.filter(Group.isGroup).flatMap(g => {
            return (g as Group).favoritesDeep([]);
        });
        return favorites.concat(res);
    }

    /**
     * Saves the favorites to the underlying storage
     */
    private persist(): Thenable<void> {
        return vscode.workspace.fs.writeFile(this.storeUri, Buffer.from(JSON.stringify(this._favorites, null, 4)));
    }

    /**
     * Creates a restoration point and saves the list of files which will need to be reopened in a new window
     * @param uris The list of URIs to be opened after the next launch
     * @returns Nothing special
     */
    createRestorationPoint(uris: vscode.Uri[]): Thenable<void>{
        return vscode.workspace.fs.writeFile(this.restoreUri, Buffer.from(JSON.stringify(uris.map(u=>u.fsPath), null, 4)));
    }

    /**
     * Attemps to read the list of files which needs to be reopened.
     * This feature is used by the Open files in new window command.
     * @returns The list of files to restore
     */
    async loadResorationPoint(): Promise<vscode.Uri[]>{
        let stat = await vscode.workspace.fs.stat(this.restoreUri);
        if(!stat) {return [];}

        // Read and delete the restore point so if something fails, the user is not stuck in an infinite failing loop
        const buffer = await vscode.workspace.fs.readFile(this.restoreUri);
        vscode.workspace.fs.delete(this.restoreUri);

        return  (JSON.parse(buffer.toString()) as string[])?.map(s=>vscode.Uri.file(s)) || [];
    }
}