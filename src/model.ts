import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';

export interface Bookmarkable {
    label: string; // User given label
    parent?: Bookmarkable; // Uuid of its parent
    description?: string; // Used only for QuickPick displays. Contains the parent group if any, updated before each display

    /**
     * Converts the present object to a TreeItem.
     * @returns A TreeItem object
     */
    toTreeItem(): TreeItem;

    /**
     * Compares the present object to the provided one.
     * @param another A Bookmarkable object to compare to
     * @returns -1, 0 or 1 if respectively this object is smaller, equal or greather than the one it is being compared to.
     * @see Array.sort
     */
    compareTo(another: Bookmarkable): number;

    /**
     * Any bookmarkable element should control its serialization.
     * @param key 
     */
    toJSON(key: any): void;
}

export abstract class Bookmark implements Bookmarkable {
    label: string; // User given label
    description?: string; // Used only for QuickPick displays. Contains the parent group if any, updated before each display

    constructor() {
        this.label = '';
    }

    /**
     * Any bookmarkable element should control its serialization.
     * @param key 
     */
    abstract toJSON(key: any): void;

    /**
     * Converts the present object to a TreeItem.
     * @returns A TreeItem object
     */
    abstract toTreeItem(): TreeItem;

    /**
     * Compares the present object to the provided one.
     * Comparison is done using the <pre>bookmarkableComparator</pre> function
     * @param another A Bookmarkable object to compare to
     * @returns -1, 0 or 1 if respectively this object is smaller, equal or greather than the one it is being compared to.
     * @see Array.sort
     * @see bookmarkableComparator
     */
    compareTo(other: Bookmarkable): number { return bookmarkableComparator(this, other); }
}

/**
 * A Bookmarkable object which can contain sub items.
 */
export class Group extends Bookmark {
    parent?: Group; // Uuid of the parent Favorite
    children: Bookmarkable[] = []; // Child items


    /**
     * @returns true if this group has children
     */
    get hasChildren(): boolean {
        return this.children && this.children.length > 0;
    }

    constructor() {
        super();
    }

    /**
     * Converts the present object to a TreeItem.
     * @returns A TreeItem object
     */
    toTreeItem(): TreeItem {
        let item: TreeItem = new TreeItem('Undefined', TreeItemCollapsibleState.None);
        item = new TreeItem(this.label, TreeItemCollapsibleState.Collapsed);
        item.label = this.label;
        item.iconPath = ThemeIcon.Folder;
        item.contextValue = 'group';
        return item;
    }

    /**
     * Adds a new child.
     * @param item The Bookmarkable to add
     */
    addChild(item: Bookmarkable) {
        this.children.push(item);
        item.parent = this;
    }

    /**
     * Removes a child from this group's immediate childrens.
     * @param item The Bookmarkable to remove
     */
    removeChild(item: Bookmarkable) {
        var index = this.children.indexOf(item);
        if (index < 0) { return; }
        this.children[index].parent = undefined;
        this.children.splice(index, 1);
    }

    toJSON(key: any) {
        return { label: this.label, children: this.children };
    }

    /**
     * Checks wether an IFavorite is a group.
     * @param a An IFavorite
     */
    static isGroup(a: Bookmarkable) {
        return (a as Group).children !== undefined;
    }

    groups(): Group[] {
        let res = this.children.flatMap(x => {
            if (Group.isGroup(x)) {
                let g = x as Group;
                let childrens = g.groups();
                childrens.push(g);
                return childrens;
            } else {
                return [] as Group[];
            }
        });
        return res;
    }

    favorites(ancestors: Group[]): Favorite[] {
        ancestors.push(this);
        var path = ancestors.reduce((acc, val, index) => acc + `\\${val.label}`, '');
        var favs = this.children.filter(x => !Group.isGroup(x)).map(y => {
            y.description = ` $(folder) ${path}`;
            return y as Favorite;
        });
        
        let childs = this.children.filter(Group.isGroup).flatMap(x => (x as Group).favorites(ancestors));
        ancestors.pop();
        return favs.concat(childs);
    }
}

/**
 * A Favorited file.
 */
export class Favorite extends Bookmark {
    parent?: Bookmarkable; // Uuid of the parent Favorite
    resourcePath: string; // Path to the resource

    /**
     * @returns An additional description for the Favorite to be displayed in quick pick items (only if using user defined label)
     */
    get detail(): string | undefined {
        return this.label !== this.resourcePath ? this.resourcePath : undefined;
    }

    /**
     * @returns an URI object poiting to the underlying fs resource
     */
    get resourceUri(): Uri {
        return Uri.file(this.resourcePath);
    }

    constructor() {
        super();
        this.resourcePath = '';
    }

    /**
     * Converts the present object to a TreeItem.
     * @returns A TreeItem object
     */
    toTreeItem(): TreeItem {
        let item: TreeItem = new TreeItem('Undefined', TreeItemCollapsibleState.None);
        item = new TreeItem(this.label, TreeItemCollapsibleState.None);
        item.label = this.label;
        item.resourceUri = this.resourceUri;
        item.iconPath = ThemeIcon.File;
        item.tooltip = this.resourcePath;
        item.command = {
            command: 'fav.context.openResource',
            arguments: [item.resourceUri],
            title: 'Open Favorite'
        };
        return item;
    }

    toJSON(key: any) {
        return { label: this.label, resourcePath: this.resourcePath };
    }
}

/**
* A comparator helper, useful for instance to be called in Array.sort() calls.
* Compare this Favorite to another one.
* Favorites are always compared using their labels. 
* If a group is compared with a standard Favorite, the result will be such that the group will appear first in the sorted result
* @param a A Favorite
* @param b Another Favorite
*/
export function bookmarkableComparator(a: Bookmarkable, b: Bookmarkable): number {
    if (Group.isGroup(a) !== Group.isGroup(b)) {
        return Group.isGroup(a) ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
}


/**
   * A comparator helper, useful for instance to be called in Array.sort() calls.
   * Compare this Favorite to another one and ignores the kind differences
   * @param a A Favorite
   * @param b Another Favorite
   */
export function bookmarkableLabelComparator(a: Bookmarkable, b: Bookmarkable) {
    return a.label.localeCompare(b.label);
}