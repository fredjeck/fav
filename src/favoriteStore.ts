import * as vscode from 'vscode';
import { Favorite, FavoriteKind } from './favorite';

export class FavoriteStore {

    private static readonly FAV_STORE_STATE_KEY = "fav.store";

    private _onFavoriteAdded: vscode.EventEmitter<Favorite> = new vscode.EventEmitter();
    readonly onFavoriteAdded: vscode.Event<Favorite> = this._onFavoriteAdded.event;

    private _onFavoriteUpdated: vscode.EventEmitter<Favorite> = new vscode.EventEmitter();
    readonly onFavoriteUpdated: vscode.Event<Favorite> = this._onFavoriteUpdated.event;

    private _onFavoriteDeleted: vscode.EventEmitter<Favorite> = new vscode.EventEmitter();
    readonly onFavoriteDeleted: vscode.Event<Favorite> = this._onFavoriteDeleted.event;


    private static _instance: FavoriteStore;
    private _favorites: Favorite[];

    private constructor(private context: vscode.ExtensionContext, clear = false) {
        if (clear) {
            this._favorites = [];
            this.context.globalState.update(FavoriteStore.FAV_STORE_STATE_KEY, this._favorites);
            return;
        }

        this._favorites = context.globalState.get<Favorite[]>(FavoriteStore.FAV_STORE_STATE_KEY)?.map(f => {
            let fav = Object.assign(new Favorite(), f);
            if(f.children && f.children.length){
                fav.children = f.children.map(child=>{
                    let c = Object.assign(new Favorite(), child);
                    c.parent =f;
                    return c;
                });
            }
            return fav;
        }) || [];
    };

    public static load(context: vscode.ExtensionContext, clear = false): FavoriteStore {
        if (!FavoriteStore._instance) {
            FavoriteStore._instance = new FavoriteStore(context);
        }
        return FavoriteStore._instance;
    }

    // Todo change the way we refer to the store
    public static current(): FavoriteStore {
        if (!FavoriteStore._instance) {
            throw new Error("Favorites store has not been initialized prior its first access");
        }
        return FavoriteStore._instance;
    }

    public add(fav: Favorite): void {
        // Todo detect duplicates
        this._favorites.push(fav);
        this.context.globalState.update(FavoriteStore.FAV_STORE_STATE_KEY, this._favorites);
        this._onFavoriteAdded.fire(fav);
    }

    public update(fav: Favorite): void {
        this.context.globalState.update(FavoriteStore.FAV_STORE_STATE_KEY, this._favorites);
        this._onFavoriteUpdated.fire(fav);
    }

    public delete(fav: Favorite): void {
        this._favorites.splice(this._favorites.indexOf(fav), 1);
        this._onFavoriteDeleted.fire(fav);
    }

    public favorites(): Favorite[] {
        return [...this._favorites];
    }

    public groups(): Favorite[] {
        return this._favorites.filter(f => FavoriteKind.group === f.kind);
    }
}