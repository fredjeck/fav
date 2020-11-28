import { Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem } from 'vscode';
import { Favorite } from './model';
import { FavoriteStore } from './store';

/**
 * A TreeDataProvider for Favorites.
 * @see TreeDataProvider
 */
export class FavoritesTreeDataProvider  implements TreeDataProvider<Favorite>{
    private _onDidChangeTreeData: EventEmitter<Favorite | undefined | null | void> = new EventEmitter<Favorite | undefined | null | void>();
    readonly onDidChangeTreeData: Event<Favorite | undefined | null | void> = this._onDidChangeTreeData.event;

    private _store:FavoriteStore;
    constructor(store:FavoriteStore){
        this._store = store;
    }
  
    refresh(f:Favorite | undefined | null | void): void {
      this._onDidChangeTreeData.fire(f);
    }
    
    getTreeItem(element: Favorite): TreeItem | Thenable<TreeItem> {
        return element.toTreeItem();
    }

    getParent(element:Favorite): ProviderResult<Favorite>{
        return this._store.getParent(element);
    }

    getChildren(element?: Favorite): ProviderResult<Favorite[]> {
        if(!element){
            return this._store.favorites();
        }else if(element && element.children && element.children.length >0){
            return element.children.sort(Favorite.comparatorFn);
        }
        return undefined;
    }
}