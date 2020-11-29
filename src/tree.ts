import { Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem } from 'vscode';
import { Bookmarkable, bookmarkableComparator, Favorite, Group, isGroup } from './model';
import { FavoriteStore } from './store';

/**
 * A TreeDataProvider for Favorites.
 * @see TreeDataProvider
 */
export class FavoritesTreeDataProvider implements TreeDataProvider<Bookmarkable>{
    private _onDidChangeTreeData: EventEmitter<Bookmarkable | undefined | null | void> = new EventEmitter<Bookmarkable | undefined | null | void>();
    readonly onDidChangeTreeData: Event<Bookmarkable | undefined | null | void> = this._onDidChangeTreeData.event;

    private _store: FavoriteStore;
    constructor(store: FavoriteStore) {
        this._store = store;
    }

    refresh(f: Bookmarkable | undefined | null | void): void {
        this._onDidChangeTreeData.fire(f);
    }

    getTreeItem(element: Bookmarkable): TreeItem | Thenable<TreeItem> {
        return element.toTreeItem();
    }

    getParent(element: Bookmarkable): ProviderResult<Bookmarkable> {
        return this._store.getParent(element);
    }

    getChildren(element?: Bookmarkable): ProviderResult<Bookmarkable[]> {
        if (!element) {
            return this._store.all();
        } else if (isGroup(element)) {
            return (element as Group).children.sort(bookmarkableComparator);
        }
        return undefined;
    }
}