import * as vscode from 'vscode';
import { FavoriteManager } from './favoriteManager';

export function activate(context: vscode.ExtensionContext) {
	new FavoriteManager(context);
	console.log('Extension "fav" is now active!');
}

// this method is called when your extension is deactivated
export function deactivate() { }
