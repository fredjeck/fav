import { create } from 'domain';
import {glob} from 'glob';
import { URLSearchParams } from 'url';
import * as vscode from 'vscode';
import { Bookmarkable, BookmarkableKind, bookmarkableLabelComparator, Favorite, Folder, Group, RootGroup } from './model';
import { FavoriteStore } from './store';
import { FavoritesTreeDataProvider } from './tree';
import { Utils } from './utils';

/**
 * Core Extension component.
 */
export class FavoriteManager {

    private _treeView: vscode.TreeView<Bookmarkable>; // Favorites tree view mainly used for revealing favorites upon updates
    private _store: FavoriteStore; // Underlying storage
    private _provider: FavoritesTreeDataProvider; // Treeview Data provider

    constructor(context: vscode.ExtensionContext) {
        this._store = FavoriteStore.fromContext(context, () => this._provider.refresh());

        this._provider = new FavoritesTreeDataProvider(this._store);

        this._treeView = vscode.window.createTreeView('fav-favorites', {
            treeDataProvider: this._provider,
            canSelectMany: false
        });

        this.registerCommands(context);

        vscode.workspace.onDidSaveTextDocument(document => {
            // If the user saves the favorites.json file, we reserve some special treatment
            if (document.uri.fsPath === this._store.storeUri.fsPath) {
                this.reloadFavorites();
            }
        });

        this._store.loadResorationPoint().then(uris =>{
            if(uris && uris.length>0){
                uris.forEach(uri=>{
                    console.log(uri);
                    vscode.window.showTextDocument(uri, { preview: false });
                });
            }
        });
    }

    /**
     * Adds the selected GUI element to the Favorites list (top level).
     * @param node The selected element in the GUI.
     * @param toGroup If true, prompts the user for a group selection.
     */
    async addToFavorites(node: any, kind: BookmarkableKind, toGroup = false): Promise<void> {

        let fav: Bookmarkable | undefined;
        switch (kind) {
            case BookmarkableKind.Folder:
                fav = await this.createFolder(node);
                break;
            default:
                fav = await this.createFavorite(node);
        }

        if (!fav) {
            return;
        }

        if (!toGroup) {
            this._store.add(fav);
            this._provider.refresh();
            this._treeView.reveal(fav, { select: true, focus: true });
        } else {
            let group = await this.promptGroupSelection(false);
            if (group) {
                group?.addChild(fav);
                this._store.update(group);
                this._provider.refresh(group);
                this._treeView.reveal(fav);
            }
        }
    }

    /**
     * Gathers all the necessary information to create a new favorite
     * @param node The element to favorite
     */
    private async createFavorite(node: any): Promise<Bookmarkable | undefined> {
        let path = this.selectedElementPath(node);
        if (!path) {
            return undefined;
        }

        let label = await vscode.window.showInputBox({ prompt: 'Name of your new favorite (as shown in the Fav:Explorer view)', value: Utils.fileName(path as string) });
        if (!label) { return undefined; }

        let fav = new Favorite();
        fav.label = label;
        fav.resourcePath = path || '';

        return fav;
    }

    /**
     * Gathers all the necessary information to create a new folder
     * @param node The element to favorite
     */
    private async createFolder(node: any): Promise<Bookmarkable | undefined> {
        let path = this.selectedElementPath(node);
        if (!path || !node) {
            var uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, title: 'Please select the folder add to your favorites' });
            if (!uris) {
                return undefined;
            }
            path = uris[0].fsPath;
        }

        let label = await vscode.window.showInputBox({ prompt: 'Name of your new favorite (as shown in the Fav:Explorer view)', value: Utils.fileName(path as string) });
        if (!label) { return undefined; }

        let filter = await vscode.window.showInputBox({ prompt: 'File filter (glob patterns are supported) - only matches files', value: Folder.DefaultFileFiter }) || Folder.DefaultFileFiter;
        if (!filter) { return undefined; }

        let fav = new Folder();
        fav.label = label;
        fav.resourcePath = path || '';
        fav.filter = filter;

        return fav;
    }

    private async changeFileFilter(node:Folder):Promise<void>{
        let filter = await vscode.window.showInputBox({ prompt: 'File filter (glob patterns are supported) - only matches files', value: node.filter }) || Folder.DefaultFileFiter;
        if (!filter) { return; }

        node.filter = filter;
        this._store.update(node);
        this._provider.refresh(node);
        this._treeView.reveal(node, { select: true, focus: true });
    }

    /**
     * Opens the favorites.json file for edition
     */
    editFavorites(): void {
        vscode.window.showTextDocument(this._store.storeUri, { preview: false, preserveFocus: false });
        vscode.window.showWarningMessage('Please be careful when manually editing your favorites', 'Understood');
    }

    /**
     * Forces the store to reload the favorites from the favorites.json file
     */
    async reloadFavorites(): Promise<void> {
        try {
            await this._store.refresh();
        } catch (err) {
            vscode.window.showErrorMessage(err.message, 'Ok');
        }
    }

    /**
     * Shows the user a QuickPick in which he can choose the favorite to open.
     */
    async openFavorite(): Promise<void> {
        let favorites = this._store.favorites();

        let favorite = await vscode.window.showQuickPick(favorites);
        favorite?.activate();
    }

    /**
     * Opens all the Favorites registered in the group selected by the user.
     * Group selection is performed via QuickPick.
     * @param group A favorite group, if no group is provided the user will be prompted to pick a group.
     */
    async openGroup(group?: Group): Promise<void> {
        if (!group) {
            group = await this.promptGroupSelection(false);
        }

        group?.activate();
    }

    /**
     * Adds a new group to the favorites bar.
     */
    async createGroup(parent?: Group): Promise<void> {
        let label = await vscode.window.showInputBox({ prompt: 'Name of your new group (as shown in the Fav:Explorer view) :', value: 'New group' });
        if (!label) { return; }

        let group = new Group();
        group.label = label;

        if (parent) {
            parent.addChild(group);
            this._store.update();
        } else {
            this._store.add(group);
        }
        this._provider.refresh(undefined);
        this._treeView.reveal(group);
    }

    /**
     * Deletes a Favorite from the stored Favorites.
     * @param favorite The Favorite to delete
     */
    async removeFavorite(favorite: Bookmarkable): Promise<void> {
        if (favorite) {
            let choice = await vscode.window.showWarningMessage(`Remove '${favorite.label}' from your favorites ?`, 'Yes', 'No');
            if ('Yes' === choice) {
                this._store.delete(favorite);
                this._provider.refresh(undefined);
            }
        }
    }

    /**
     * Utility function to open a URI in a new Window.
     * @param resource A resource URI
     */
     async openInNewWindow(favorite: Bookmarkable): Promise<void> {
        if(favorite instanceof Group){return;}
        await vscode.commands.executeCommand('vscode.openFolder', favorite.location()[0], {forceNewWindow:true});
    }

    /**
     * Open a folder files in a new window.
     * @param resource A resource URI
     */
     async openFilesInNewWindow(favorite: Folder): Promise<void> {
        let matches = glob.sync(favorite.filter, { cwd: favorite.resourceUri.fsPath, nodir: true, absolute: true });
        let uris = matches.map(m=>vscode.Uri.file(m));
        this._store.createRestorationPoint(uris);
        await vscode.commands.executeCommand('vscode.openFolder', uris[0], {forceNewWindow:true});
    }

    /**
     * Prompts the user for a group to move the favorite to.
     * @param favorite The favorite to move to another group
     */
    async moveFavorite(favorite: Bookmarkable): Promise<void> {
        if (!favorite) {
            return;
        }
        let group = await this.promptGroupSelection(true, favorite.parent ?? RootGroup);
        if (group) {
            if (favorite.parent) {
                (favorite as Group).parent?.removeChild(favorite);
            } else {
                // Top level Favorite
                this._store.delete(favorite);
            }
            if(group === RootGroup){
                this._store.add(favorite);
            }else{
                group.addChild(favorite);
            }
            
            this._store.update();
            this._provider.refresh();
            this._treeView.reveal(favorite);
        }
    }

    /**
     * Renames a Favorite'
     * @param bk The Favorite to rename
     */
    async renameFavorite(bk: Bookmarkable): Promise<void> {
        if (bk) {
            let label = await vscode.window.showInputBox({ prompt: 'Rename to', value: bk.label });
            if (label) {
                bk.label = label;
                this._store.update(bk);
                this._provider.refresh(bk);
                this._treeView.reveal(bk);
            }
        }
    }

    /**
     * Utility function to open a URI in a text editor.
     * @param resource A resource URI
     */
    openResource(resource: Favorite): void {
        resource.activate();
    }

    /**
     * Register the extension's commands.
     * @param context The extension's context
     */
    private registerCommands(context: vscode.ExtensionContext): void {
        // File explorer menu
        context.subscriptions.push(vscode.commands.registerCommand('fav.menu.favoriteActiveFile', (node) => this.addToFavorites(node, BookmarkableKind.Favorite, false), this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.menu.favoriteActiveFolder', (node) => this.addToFavorites(node, BookmarkableKind.Folder, false), this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.menu.favoriteActiveFileToGroup', (node) => this.addToFavorites(node, BookmarkableKind.Favorite, true), this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.menu.favoriteActiveFolderToGroup', (node) => this.addToFavorites(node, BookmarkableKind.Folder, true), this));

        // Command palette
        context.subscriptions.push(vscode.commands.registerCommand('fav.palette.favoriteActiveFile', (node) => this.addToFavorites(node, BookmarkableKind.Favorite, false), this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.palette.favoriteActiveFileToGroup', (node) => this.addToFavorites(node, BookmarkableKind.Favorite, true), this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.palette.favoriteFolder', (node) => this.addToFavorites(undefined, BookmarkableKind.Folder, false), this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.palette.edit', this.editFavorites, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.palette.reload', this.reloadFavorites, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.palette.openFavorite', this.openFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.palette.createGroup', this.createGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.palette.openGroup', this.openGroup, this));

        // Contextual actions triggered from the favorites bar
        context.subscriptions.push(vscode.commands.registerCommand('fav.view.createGroup', this.createGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.removeFavorite', this.removeFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.renameFavorite', this.renameFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.moveFavorite', this.moveFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.openGroup', this.openGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.createGroup', this.createGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.openResource', this.openResource, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.changeFileFilter', this.changeFileFilter, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.openInNewWindow', this.openInNewWindow, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.context.openFilesInNewWindow', this.openFilesInNewWindow, this));

    }

    /**
     * Utility function to return the selected element's path.
     * @param node some kind of object
     */
    private selectedElementPath(node: any): string | undefined {
        if (node && node.fsPath) {
            return node.fsPath;
        } else if (vscode.window.activeTextEditor) {
            return vscode.window.activeTextEditor.document.uri.fsPath;
        } else {
            return undefined;
        }
    }

    /**
     * Opens a quickpick and prompts the user to select a Favorite group.
     */
    private async promptGroupSelection(showRoot:boolean, ...exclusions: (Bookmarkable | undefined)[]): Promise<Group | undefined> {
        var root = showRoot ? [RootGroup] : [];
        let groups = root.concat(this._store.groups());
        if (!groups || groups.length === 0) {
            vscode.window.showWarningMessage('No favorite groups found, please define a group first');
            return undefined;
        }

        return vscode.window.showQuickPick(groups.filter(f => !exclusions.find(x => x === f)),{placeHolder:'Please select a favorites group'});
    }
}