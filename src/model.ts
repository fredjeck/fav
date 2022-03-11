import * as vscode from 'vscode';
import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { sep } from 'path';
import { glob } from 'glob';

export enum BookmarkableKind{
    Group,
    Favorite,
    Folder
}

/**
 * Base interace for any object which can be bookmarked and rendered in the Favorite's bar.
 */
export interface Bookmarkable {
    label: string; // The object's human readable label, displayed in the Favorite's bar and in Quick Picks
    parent?: Bookmarkable; // A Bookmarkable can be nested under another Bookmarkable element, if so this property holds a reference to its parent
    description?: string; // An extended description - to be used as additional informatio  in QuickPicks

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
     * Any Bookmarkable element should control its serialization and remove cyclic dependencies
     * @param key 
     * @see Object.toJSON
     */
    toJSON(key: any): void;

    /**
     * Favorites are striving for litterally one thing : being activated by their hooman.
     * Triggers the action linked to the favorite type.
     */
    activate(): void;

    /**
     * @returns the location of the underlying favorites.
     */
    location(): vscode.Uri[]
}

/**
 * Base abstract class for Bookmarkable objects.
 */
export abstract class Bookmark implements Bookmarkable {
    label = '';
    parent?: Bookmarkable;

    /**
     * @see Bookmarkable
     */
    abstract toJSON(key: any): void;

    /**
    * @see Bookmarkable
    */
    abstract toTreeItem(): TreeItem;

    /**
     * @see Bookmarkable
     */
    abstract activate(): void;

    /**
     * @see Bookmarkable
     */
     abstract location(): vscode.Uri[];

    /**
     * Compares the present Bookmarkable to the provided one.
     * Comparison is done using the <pre>bookmarkableComparator</pre> function
     * @param another A Bookmarkable object to compare to
     * @returns -1, 0 or 1 if respectively this object is smaller, equal or greather than the one it is being compared to.
     * @see Bookmarkable
     * @see Array.sort
     * @see bookmarkableComparator
     */
    compareTo = (other: Bookmarkable): number => bookmarkableComparator(this, other);
}

/**
 * A Group is a special kind of Bookmarkable object which can contain nested Bookmarkable objects.
 */
export class Group extends Bookmark {
    children: Bookmarkable[] = [];
    parent?: Group;

    /**
    * Checks wether a Bookmarkable object is a group.
    * @param item A Bookmarkable object
    */
    static isGroup(item: Bookmarkable) {
        return (item as Group).children !== undefined;
    }

    /**
     * @see Bookmarkable
     */
    toTreeItem(): TreeItem {
        let item: TreeItem = new TreeItem('Undefined', TreeItemCollapsibleState.None);
        item = new TreeItem(this.label, TreeItemCollapsibleState.Collapsed);
        item.label = this.label;
        item.iconPath = ThemeIcon.Folder;
        item.contextValue = this.favoritesDeep().length > 0 ? 'group' : 'group-empty';
        return item;
    }

    /**
     * Adds a new child to this group. 
     * No duplication check is performed upon addition.
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

    /**
     * @see Object.toJSON
     * @see Bookmarkable
     */
    toJSON(key: any) {
        return { label: this.label, children: this.children };
    }


    /**
     * @returns a flat list of all the groups nested in this group and its sub groups
     */
    groupsDeep(ancestors: Group[] = []): Group[] {
        ancestors.push(this);
        var breadcrumb = ancestors.reduce((acc, val, index) => acc + `${acc.length === 0 ? '' : sep}${val.label}`, '');

        let groups = this.children.filter(Group.isGroup) as Group[];
        let res = groups.flatMap(x => {
            (x as Bookmarkable).description = ` $(folder) ${breadcrumb}`;
            let subgroups = x.groupsDeep(ancestors);
            subgroups.push(x);
            return subgroups;
        });
        ancestors.pop();
        return res;
    }

    /**
     * @param ancestors A list of ancestor groups used to update the favorite's description.
     * @returns a flat list of all the favorites nested in this group and its sub groups
     */
    favoritesDeep(ancestors: Group[] = []): Favorite[] {
        ancestors.push(this);
        var breadcrumb = ancestors.reduce((acc, val, index) => acc + `${acc.length === 0 ? '' : sep}${val.label}`, '');

        var favs = this.children.filter(x => !Group.isGroup(x)).map(y => {
            y.description = ` $(folder) ${breadcrumb}`;
            return y as Favorite;
        });

        let childs = this.children.filter(Group.isGroup).flatMap(x => (x as Group).favoritesDeep(ancestors));
        ancestors.pop();
        return favs.concat(childs);
    }

    /**
     * @see Bookmarkable
     */
    activate(): void {
        this.favoritesDeep().forEach(f => f.activate());
    }

    /**
     * @see Bookmarkable
     */
     location(): vscode.Uri[] {
        return this.favoritesDeep().flatMap(f => f.location());
    }
}

/**
 * Root Group represents the top level element of the tree structure.
 */
export const RootGroup = new Group();
RootGroup.label = '-- root';

/**
 * A Bookmarkable object which points to a file system resource.
 */
export class Favorite extends Bookmark {
    resourcePath = ''; // Path to the file system resource
    parent?: Group;

    /**
     * @returns A human-readable string which is rendered less prominent in a separate line in QuickPicks
     * @see QuickPickItem.detail
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
            arguments: [this],
            title: 'Open Favorite'
        };
        return item;
    }

    /**
     * @see Bookmarkable
     */
    toJSON(key: any) {
        return { label: this.label, resourcePath: this.resourcePath };
    }

    /**
     * @see Bookmarkable
     */
    activate(): void {
        vscode.window.showTextDocument(this.resourceUri, { preview: false });
    }

    location():vscode.Uri[]{
        return [this.resourceUri];
    }
}

/**
 * A Bookmarkable object which points to a folder
 */
export class Folder extends Bookmark {

    static readonly DefaultFileFiter = '*';

    resourcePath = ''; // Path to the file system resource
    filter = Folder.DefaultFileFiter; // Glob filter
    parent?: Group;

    /**
     * @returns A human-readable string which is rendered less prominent in a separate line in QuickPicks
     * @see QuickPickItem.detail
     */
    get detail(): string | undefined {
        return `${this.label !== this.resourcePath ? this.resourcePath : ''} [ ${this.filter} ]`;
    }

    /**
     * @returns an URI object poiting to the underlying fs resource
     */
    get resourceUri(): Uri {
        return Uri.file(this.resourcePath);
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
        item.iconPath = new ThemeIcon('files');
        item.tooltip = this.resourcePath;
        item.command = {
            command: 'fav.context.openResource',
            arguments: [this],
            title: 'Open Favorite'
        };
        item.description = `[ ${this.filter} ]`;
        item.contextValue = 'folder';
        return item;
    }

    /**
     * @see Bookmarkable
     */
    toJSON(key: any) {
        return { label: this.label, filter: this.filter, resourcePath: this.resourcePath };
    }

    /**
     * @see Bookmarkable
     */
    activate(): void {
        let matches = glob.sync(this.filter, { cwd: this.resourceUri.fsPath, nodir: true, absolute: true });
        matches.forEach(entry => vscode.window.showTextDocument(vscode.Uri.file(entry), { preview: false }));
    }

    location(): vscode.Uri[]{
        return [this.resourceUri];
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