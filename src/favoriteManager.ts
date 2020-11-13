import * as vscode from 'vscode';
import { Favorite, FavoriteKind } from './favorite';
import { FavoriteStore } from './favoriteStore';
import { FavoritesTreeDataProvider } from './favoriteTreeDataProvider';

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
                vscode.window.showInformationMessage('Current Editor Added to favorites');
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

    openResource(resource: vscode.Uri): void {
        vscode.window.showTextDocument(resource, { preview: false });
    }

    deleteFavorite(favorite: Favorite): void {
        if (favorite) {
            vscode.window.showWarningMessage(`Remove '${favorite.label}' from your favorites ?`, 'Yes', 'No').then(choice => {
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
        context.subscriptions.push(vscode.commands.registerCommand('fav.favoriteActiveFile', this.favoriteActiveFile, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.openFavorite', this.openFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.deleteFavorite', this.deleteFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.renameFavorite', this.renameFavorite, this));
        context.subscriptions.push(vscode.commands.registerCommand('fav.openResource', resource => this.openResource(resource)));
    }
}