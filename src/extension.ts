import * as vscode from 'vscode';
import { FavoriteManager } from './favoriteManager';

export function activate(context: vscode.ExtensionContext) {
	new FavoriteManager(context);
}

export function deactivate() { }
