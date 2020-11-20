import * as vscode from 'vscode';
import { Favorite, FavoriteKind } from './favorite';

export class FavoriteStore {

    private static readonly FAV_STORE_STATE_KEY = 'fav.store'; // The store key in the global VSCode state.

    private _onFavoriteAdded: vscode.EventEmitter<Favorite> = new vscode.EventEmitter();
    /**
     * Event emitted whenever a new Favorite is added to the store.
     */
    readonly onFavoriteAdded: vscode.Event<Favorite> = this._onFavoriteAdded.event;

    private _onFavoriteUpdated: vscode.EventEmitter<Favorite> = new vscode.EventEmitter();
    /**
     * Event emitted whenever a Favorite is updated into the store.
     */
    readonly onFavoriteUpdated: vscode.Event<Favorite> = this._onFavoriteUpdated.event;

    private _onFavoriteDeleted: vscode.EventEmitter<Favorite> = new vscode.EventEmitter();
    /**
     * Event emitted whenever a Favorite is removed from store.
     */
    readonly onFavoriteDeleted: vscode.Event<Favorite> = this._onFavoriteDeleted.event;


    private static _instance: FavoriteStore; // Current store instance
    private _favorites: Favorite[]; // Underlying favorite storage

    /**
     * Instantiates the store, cannot be called directly.
     * A store instance should be obtained via the load method for an initial call() and via the current() method for any subsequent calls.
     * @param context The extension context we are running in
     * @param clear If true, clears the store
     */
    private constructor(private context: vscode.ExtensionContext, clear = false) {
        if (clear) {
            this._favorites = [];
            this.context.globalState.update(FavoriteStore.FAV_STORE_STATE_KEY, this._favorites);
            return;
        }

        this._favorites = context.globalState.get<Favorite[]>(FavoriteStore.FAV_STORE_STATE_KEY)?.map(f => {
            let fav = Object.assign(new Favorite(), f);
            if (f.children && f.children.length) {
                fav.children = f.children.map(child => {
                    let c = Object.assign(new Favorite(), child);
                    c.parent = f.uuid;
                    return c;
                });
            }
            return fav;
        }) || [];
    };

    /**
     * Initializes the store, if already initialized, returns the already configured instance instead.
     * @param context The extension context we are running in
     * @param clear If true, clears the store
     * @returns The store instance
     */
    public static load(context: vscode.ExtensionContext, clear = false): FavoriteStore {
        if (!FavoriteStore._instance) {
            FavoriteStore._instance = new FavoriteStore(context);
        }
        return FavoriteStore._instance;
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
     * @param fav The favorite to add
     */
    public add(fav: Favorite): void {
        this._favorites.push(fav);
        this.context.globalState.update(FavoriteStore.FAV_STORE_STATE_KEY, this._favorites);
        this._onFavoriteAdded.fire(fav);
    }

    /**
     * Updates a Favorite in the store and notifies all the subscribers of the newly updated favorite.
     * @emits FavoriteSTore.onFavoriteUpdated
     * @param fav The favorite to add
     */
    public update(fav: Favorite): void {
        this.context.globalState.update(FavoriteStore.FAV_STORE_STATE_KEY, this._favorites);
        this._onFavoriteUpdated.fire(fav);
    }

    /**
     * Deletes a Favorite from the store and notifies all the subscribers of the deleted favorite.
     * @emits FavoriteSTore.onFavoriteDeleted
     * @param fav The favorite to add
     */
    public delete(fav: Favorite): void {
        this._favorites.splice(this._favorites.indexOf(fav), 1);
        this.context.globalState.update(FavoriteStore.FAV_STORE_STATE_KEY, this._favorites);
        this._onFavoriteDeleted.fire(fav);
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

}