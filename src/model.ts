import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export interface Bookmarkable {
    label: string; // User given label
    uuid: string; // Unique ID for the for this resource
    parent?: string; // Uuid of its parent

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
}

export abstract class Bookmark implements Bookmarkable {
    label: string; // User given label
    uuid: string; // Unique ID for the for this resource
    parent?: string; // Uuid of the parent Favorite

    constructor() {
        this.uuid = uuidv4();
        this.label = '';
    }

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
        item.parent = this.uuid;
    }

    /**
     * Removes a child from this group's immediate childrens.
     * @param item The Bookmarkable to remove
     */
    removeChild(item: Bookmarkable) {
        var index = this.children.findIndex(x => x.uuid === item.uuid);
        if (index < 0) { return; }
        this.children[index].parent = undefined;
        this.children.splice(index, 1);
    }
}

/**
 * A Favorited file.
 */
export class Favorite extends Bookmark {
    resourcePath: string; // Path to the resource
    description?: string; // Used only for QuickPick displays. Contains the parent group if any, updated before each display

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
}

/**
 * Checks wether an IFavorite is a group.
 * @param a An IFavorite
 */
export function isGroup(a: Bookmarkable) {
    return (a as Group).children !== undefined;
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
    if (isGroup(a) !== isGroup(b)) {
        return isGroup(a) ? -1 : 1;
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