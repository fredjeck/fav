import * as vscode from 'vscode';
import { Favorite, FavoriteKind } from './favorite';
import { v4 as uuidv4 } from 'uuid';

export class FavoriteStore {

    private static readonly FAV_STORE_STATE_KEY = 'fav.store'; // The store key in the global VSCode state.

    private _onFavoriteAdded: vscode.EventEmitter<Favorite | undefined> = new vscode.EventEmitter();
    /**
     * Event emitted whenever a new Favorite is added to the store.
     */
    readonly onFavoriteAdded: vscode.Event<Favorite | undefined> = this._onFavoriteAdded.event;

    private _onFavoriteUpdated: vscode.EventEmitter<Favorite | undefined> = new vscode.EventEmitter();
    /**
     * Event emitted whenever a Favorite is updated into the store.
     */
    readonly onFavoriteUpdated: vscode.Event<Favorite | undefined> = this._onFavoriteUpdated.event;

    private _onFavoriteDeleted: vscode.EventEmitter<Favorite | undefined> = new vscode.EventEmitter();
    /**
     * Event emitted whenever a Favorite is removed from store.
     */
    readonly onFavoriteDeleted: vscode.Event<Favorite | undefined> = this._onFavoriteDeleted.event;

    private static _instance: FavoriteStore; // Current store instance
    private _favorites: Favorite[] = []; // Underlying favorite storage

    private _storeUri: vscode.Uri;
    get storeUri(): vscode.Uri {
        return this._storeUri;
    }

    /**
     * Instantiates the store, cannot be called directly.
     * A store instance should be obtained via the load method for an initial call() and via the current() method for any subsequent calls.
     * @param context The extension context we are running in
     */
    private constructor(private context: vscode.ExtensionContext) {
        var globalStorageUri = context.globalStorageUri;
        vscode.workspace.fs.createDirectory(globalStorageUri);
        this._storeUri = vscode.Uri.joinPath(globalStorageUri, 'favorites.json');
        this.reload();
    };

    /**
     * Initializes the store, if already initialized, returns the already configured instance instead.
     * @param context The extension context we are running in
     * @returns The store instance
     */
    public static load(context: vscode.ExtensionContext): FavoriteStore {
        if (!FavoriteStore._instance) {
            FavoriteStore._instance = new FavoriteStore(context);
        }
        return FavoriteStore._instance;
    }

    /**
     * Reloads the store from the underlying storage.
     */
    public async reload() {
        let saveRequired = false;
        const buffer = await vscode.workspace.fs.readFile(this._storeUri);

        this._favorites = (JSON.parse(buffer.toString()) as Favorite[])?.map(f => {
            let fav = Object.assign(new Favorite(), f);
            if(!f.uuid){
                // This allows editing the store configuration file manually, we will generate the UUIDs automatically afterwards
                fav.uuid = uuidv4();
                saveRequired = true; // We fixed the structure while loading, we need to re-persist the favorites
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
        if(saveRequired){
            await this.persistToStorage();
        }

        this._onFavoriteAdded.fire(undefined);
    }

    /**
     * @returns The current store instance
     */
    public static current(): FavoriteStore {
        if (!FavoriteStore._instance) {
            throw new Error('Favorites store has not been initialized prior its first access');
        }
        return FavoriteStore._instance;
    }

    /**
     * Adds a Favorite to the store and notifies all the subscribers of the newly added favorite.
     * No duplication check is performed on addition.
     * @emits FavoriteSTore.onFavoriteAdded
     * @param fav The favorites to add
     */
    public async add(...fav: Favorite[]): Promise<void> {
        this._favorites.push(...fav);
        await this.persistToStorage();
        fav.forEach(x => this._onFavoriteAdded.fire(x));
    }

    /**
     * Updates a Favorite in the store and notifies all the subscribers of the newly updated favorite.
     * @emits FavoriteSTore.onFavoriteUpdated
     * @param fav The favorites to update
     */
    public async update(...fav: (Favorite | undefined)[]): Promise<void> {
        await this.persistToStorage();
        fav.forEach(x => { if (x) { this._onFavoriteUpdated.fire(x); } });
    }

    /**
     * Deletes a Favorite from the store and notifies all the subscribers of the deleted favorite.
     * @emits FavoriteSTore.onFavoriteDeleted
     * @param fav The favorites to add
     */
    public async delete(...fav: Favorite[]): Promise<void> {
        fav.forEach(x => {
            let parent = this.getParent(x);
            if (parent) {
                parent?.removeChild(x);
            } else {
                // No parents, top level fav
                let index = this._favorites.findIndex(y => y.uuid === x.uuid);
                this._favorites.splice(index, 1);
            }
        });

        await this.persistToStorage();
        fav.forEach(x => this._onFavoriteDeleted.fire(x));
    }

    /**
     * Returns a copy of all the favorites in the store
     * The returned array is a copy of the underlying storage which contains references to the original Favorites.
     * Any change to a Favorite in this collection followed by an addition/update operation will commit the changes in the underlying storage.
     * @returns all the Favorites in the store. 
     */
    public favorites(): Favorite[] {
        return this._favorites.sort(Favorite.comparatorFn);
    }

    /**
     * Returns a copy of all the groups in the store
     * The returned array is a copy of the underlying storage which contains references to the original Favorites.
     * Any change to a Favorite in this collection followed by an addition/update operation will commit the changes in the underlying storage.
     * @returns all the Favorites in the store. 
     */
    public groups(): Favorite[] {
        return this._favorites.filter(f => FavoriteKind.Group === f.kind).sort(Favorite.comparatorFn);
    }

    /**
     * Checks if a resource path already exists in the store
     * @param path A resource path
     * @returns The Favorite to which the resource path belongs or undefined if the resource path was never favorited.
     */
    public existsInStore = (path: string) => this._favorites.find(x => x.resourcePath === path);

    /**
     * @readonly The provided Favorite's parent or undefined if no parents are declared nor found
     */
    public getParent(fav: Favorite): Favorite | undefined {
        if (!fav.parent) { return undefined; }
        return this._favorites.find(x => x.uuid === fav.parent);
    }

    /**
     * Saves the favorites to the underlying storage
     */
    private persistToStorage(): Thenable<void> {
        return vscode.workspace.fs.writeFile(this.storeUri, Buffer.from(JSON.stringify(this._favorites)));
    }
}