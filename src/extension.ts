import * as vscode from 'vscode';
import { FavoriteManager } from './manager';

export function activate(context: vscode.ExtensionContext) {
	new FavoriteManager(context);
}

export function deactivate() { }
