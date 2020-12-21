import { create } from 'domain';
import * as vscode from 'vscode';
import { Bookmarkable, BookmarkableKind, bookmarkableLabelComparator, Favorite, Folder, Group } from './model';
import { FavoriteStore } from './store';
import { FavoritesTreeDataProvider } from './tree';
import { Utils } from './utils';

/**
 * Registry of all enabled commands.
 */
export enum Commands {
    PaletteFavoriteActiveFile = 'fav.palette.favoriteActiveFile',
    PaletteFavoriteActiveFileToGroup = 'fav.palette.favoriteActiveFileToGroup',
    PaletteEdit = 'fav.palette.edit',
    PaletteReload = 'fav.palette.reload',
    PaletteFavoriteOpen = 'fav.palette.openFavorite',
    PaletteGroupCreate = 'fav.palette.createGroup',
    PaletteGroupOpen = 'fav.palette.openGroup',
    PaletteFavoriteFolder = 'fav.palette.favoriteFolder',
    ViewGroupCreate = 'fav.view.createGroup',
    ContextFavoriteMove = 'fav.context.moveFavorite',
    ContextFavoriteRemove = 'fav.context.removeFavorite',
    ContextFavoriteRename = 'fav.context.renameFavorite',
    ContextResourceOpen = 'fav.context.openResource',
    ContextCreateGroup = 'fav.context.createGroup',
    ContextGroupOpen = 'fav.context.openGroup',
    MenuFavoriteActiveFile = 'fav.menu.favoriteActiveFile',
    MenuFavoriteActiveFileToGroup = 'fav.menu.favoriteActiveFileToGroup',
    MenuFavoriteActiveFolder = 'fav.menu.favoriteActiveFolder',
    MenuFavoriteActiveFolderToGroup = 'fav.menu.favoriteActiveFolderToGroup',
}

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

        this._treeView = vscode.window.createTreeView('favorites', {
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
            let group = await this.promptGroupSelection();
            if (group) {
                group?.addChild(fav);
                this._store.update(group);
                this._provider.refresh(group);
                this._treeView.reveal(fav);
            }
        }
    }

    private async createFavorite(node: any): Promise<Bookmarkable | undefined> {
        let path = this.selectedElementPath(node);
        if (!path) {
            return undefined;
        }

        let label = await vscode.window.showInputBox({ prompt: 'Label', value: Utils.fileName(path as string) });
        if (!label) { return undefined; }

        let fav = new Favorite();
        fav.label = label;
        fav.resourcePath = path || '';

        return fav;
    }

    private async createFolder(node: any): Promise<Bookmarkable | undefined> {
        let path = this.selectedElementPath(node);
        if (!path) {
            var uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, title: 'Please select the folder to favorite' });
            if (!uris) {
                return undefined;
            }
            path = uris[0].fsPath;
        }

        let label = await vscode.window.showInputBox({ prompt: 'Label', value: Utils.fileName(path as string) });
        if (!label) { return undefined; }

        let filter = await vscode.window.showInputBox({ prompt: 'File filter (you can use glob patterns) - only matches files', value: Folder.DefaultFileFiter }) || Folder.DefaultFileFiter;
        if (!label) { return undefined; }

        let fav = new Folder();
        fav.label = label;
        fav.resourcePath = path || '';
        fav.filter = filter;

        return fav;
    }

    /**
     * Adds the selected GUI element to the Favorites list (top level).
     * @param node An element selected in the GUI.
     */
    async favoriteActiveFile(node: any): Promise<void> {
        let path = this.selectedElementPath(node);
        if (!path) {
            return;
        }

        let label = await vscode.window.showInputBox({ prompt: 'Label', value: Utils.fileName(path as string) });
        if (!label) { return; }

        let fav = new Favorite();
        fav.label = label;
        fav.resourcePath = path || '';

        this._store.add(fav);
        this._provider.refresh();
        this._treeView.reveal(fav, { select: true, focus: true });
    }

    async favoriteActiveFolder(node: any): Promise<void> {
        let path = this.selectedElementPath(node);
        if (!path) {
            var uris = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, title: 'Please select the folder to favorite' });
            if (!uris) {
                return;
            }
            path = uris[0].fsPath;
        }

        let label = await vscode.window.showInputBox({ prompt: 'Label', value: Utils.fileName(path as string) });
        if (!label) { return; }

        let filter = await vscode.window.showInputBox({ prompt: 'File filter (you can use glob patterns) - only matches files', value: Folder.DefaultFileFiter }) || Folder.DefaultFileFiter;
        if (!label) { return; }

        let fav = new Folder();
        fav.label = label;
        fav.resourcePath = path || '';
        fav.filter = filter;

        this._store.add(fav);
        this._provider.refresh();
        this._treeView.reveal(fav, { select: true, focus: true });
    }

    /**
     * Adds the selected GUI element to the Favorites list under the selected group.
     * Prompts the user via QuickPick for the group to add the Favorite to.
     * @param node An element selected in the GUI.
     */
    async favoriteActiveFileToGroup(node: any): Promise<void> {
        let path = this.selectedElementPath(node);
        if (!path) {
            return;
        }

        let group = await this.promptGroupSelection();
        if (group) {
            let label = await vscode.window.showInputBox({ prompt: 'Label', value: Utils.fileName(path as string) });
            if (!label) { return; }

            let fav = new Favorite();
            fav.label = label;
            fav.resourcePath = path || '';

            group?.addChild(fav);
            this._store.update(group);
            this._provider.refresh(group);
            this._treeView.reveal(fav);
        }
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
            group = await this.promptGroupSelection();
        }

        group?.activate();
    }

    /**
     * Adds a new group to the favorites bar.
     */
    async createGroup(parent?: Group): Promise<void> {
        let label = await vscode.window.showInputBox({ prompt: 'New favorite group name :', value: 'New group' });
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
     * Prompts the user for a group to move the favorite to.
     * @param favorite The favorite to move to another group
     */
    async moveFavorite(favorite: Bookmarkable): Promise<void> {
        if (!favorite) {
            return;
        }
        let group = await this.promptGroupSelection(favorite.parent);
        if (group) {
            if (favorite.parent) {
                (favorite as Group).parent?.removeChild(favorite);
            } else {
                // Top level Favorite
                this._store.delete(favorite);
            }

            group.addChild(favorite);
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
    registerCommands(context: vscode.ExtensionContext): void {
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteFavoriteActiveFile, (node) => this.addToFavorites(node, BookmarkableKind.Favorite, false), this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.MenuFavoriteActiveFile, (node, a, b) => this.addToFavorites(node, BookmarkableKind.Favorite, false), this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.MenuFavoriteActiveFolder, (node) => this.addToFavorites(node, BookmarkableKind.Folder, false), this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteEdit, this.editFavorites, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteReload, this.reloadFavorites, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteFavoriteActiveFileToGroup, (node) => this.addToFavorites(node, BookmarkableKind.Favorite, true), this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.MenuFavoriteActiveFileToGroup, (node) => this.addToFavorites(node, BookmarkableKind.Favorite, true), this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteFavoriteOpen, this.openFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.MenuFavoriteActiveFolderToGroup, (node) => this.addToFavorites(node, BookmarkableKind.Folder, true), this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteFavoriteFolder, (node) => this.addToFavorites(node, BookmarkableKind.Folder, false), this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteGroupCreate, this.createGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteGroupOpen, this.openGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ViewGroupCreate, this.createGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextFavoriteRemove, this.removeFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextFavoriteRename, this.renameFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextFavoriteMove, this.moveFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextGroupOpen, this.openGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextCreateGroup, this.createGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextResourceOpen, this.openResource, this));
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
    private async promptGroupSelection(...exclusions: (Bookmarkable | undefined)[]): Promise<Group | undefined> {

        let groups = this._store.groups();
        if (!groups || groups.length === 0) {
            vscode.window.showWarningMessage('No favorite groups found, please define a group first');
            return undefined;
        }

        return vscode.window.showQuickPick(this._store.groups().filter(f => !exclusions.find(x => x === f)));
    }
}