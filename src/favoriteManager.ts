import * as vscode from 'vscode';
import { Favorite, FavoriteKind } from './favorite';
import { FavoriteStore } from './favoriteStore';
import { FavoritesTreeDataProvider } from './favoriteTreeDataProvider';

export enum Commands {
    PaletteFavoriteActiveFile = 'fav.palette.favoriteActiveFile',
    PaletteFavoriteActiveFileToGroup = 'fav.palette.favoriteActiveFileToGroup',
    PaletteFavoriteOpen = 'fav.palette.openFavorite',
    PaletteGroupCreate = 'fav.palette.createGroup',
    ViewGroupCreate = 'fav.view.createGroup',
    ContextFavoriteRemove = 'fav.context.removeFavorite',
    ContextFavoriteRename = 'fav.context.renameFavorite',
    ContextResourceOpen = 'fav.context.openResource',
}


export class FavoriteManager {

    private _treeView: vscode.TreeView<Favorite>;
    private _store: FavoriteStore;

    constructor(context: vscode.ExtensionContext) {
        this._store = FavoriteStore.load(context);
        this._treeView = vscode.window.createTreeView('favorites', {
            treeDataProvider: new FavoritesTreeDataProvider(this._store),
            canSelectMany: false
        });

        this.registerCommands(context);
    }

    favoriteActiveFile(): void {
        if (vscode.window.activeTextEditor) {
            vscode.window.showInputBox({ prompt: 'Label', value: vscode.window.activeTextEditor?.document.uri.fsPath || '' }).then((v) => {
                if (!v) { return; }

                let fav = new Favorite();
                fav.label = v;
                fav.resourcePath = vscode.window.activeTextEditor?.document.uri.fsPath || '';
                fav.kind = FavoriteKind.file;

                this._store.add(fav);
                this._treeView.reveal(fav);
            });

        }
    }

    favoriteActiveFileToGroup(): void {
        if (vscode.window.activeTextEditor) {

            let groups = this._store.groups();
            if (!groups) {
                vscode.window.showWarningMessage('No favorite groups found, please define a group first');
                return;
            }

            vscode.window.showQuickPick(groups).then(selection => {
                if (selection) {
                    vscode.window.showInputBox({ prompt: 'Label', value: vscode.window.activeTextEditor?.document.uri.fsPath || '' }).then((v) => {
                        if (!v) { return; }

                        let fav = new Favorite();
                        fav.label = v;
                        fav.resourcePath = vscode.window.activeTextEditor?.document.uri.fsPath || '';
                        fav.kind = FavoriteKind.file;
                        selection.children.push(fav);
                        this._store.update(selection);
                        // TODO FIX THE PARENT ISSUE
                       // fav.parent = selection;
                       // this._treeView.reveal(fav);
                    });
                }
            });
        }
    }

    openFavorite(): void {
        vscode.window.showQuickPick(this._store.favorites()).then(selection => {
            if (selection) {
                vscode.window.showTextDocument(selection.resourceUri, { preview: false });
            }
        });
    }

    createGroup(): void {
        vscode.window.showInputBox({ prompt: 'New favorite group name :', value: 'New group' }).then((v) => {
            if (!v) { return; }

            let fav = new Favorite();
            fav.label = v;
            fav.kind = FavoriteKind.group;

            this._store.add(fav);
            this._treeView.reveal(fav);
        });
    }

    openResource(resource: vscode.Uri): void {
        vscode.window.showTextDocument(resource, { preview: false });
    }

    removeFavorite(favorite: Favorite): void {
        if (favorite) {
            var message = FavoriteKind.group === favorite.kind ? `Removing the '${favorite.label}' group will also remove all its favorite, proceed ?` : `Remove '${favorite.label}' from your favorites ?`;
            vscode.window.showWarningMessage(message, 'Yes', 'No').then(choice => {
                if ('Yes' === choice) {
                    this._store.delete(favorite);
                }
            });
        }
    }
    renameFavorite(favorite: Favorite): void {
        if (favorite) {
            vscode.window.showInputBox({ prompt: 'Rename to', value: favorite.label }).then(value => {
                if (value) {
                    favorite.label = value;
                    this._store.update(favorite);
                }
            });
        }
    }

    /**
     * Register the extension's commands.
     * @param context The extension's context
     */
    registerCommands(context: vscode.ExtensionContext): void {
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteFavoriteActiveFile, this.favoriteActiveFile, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteFavoriteActiveFileToGroup, this.favoriteActiveFileToGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteFavoriteOpen, this.openFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.PaletteGroupCreate, this.createGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ViewGroupCreate, this.createGroup, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextFavoriteRemove, this.removeFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextFavoriteRename, this.renameFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand(Commands.ContextResourceOpen, resource => this.openResource(resource)));
    }
}