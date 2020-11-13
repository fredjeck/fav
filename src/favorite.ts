import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { v4 as uuidv4 } from 'uuid';

export class Favorite {
    kind: FavoriteKind;
    resourcePath: string;
    label: string;
    uuid: string;

    get description(): string | undefined {
        return this.label !== this.resourcePath ? this.resourcePath : undefined;
    }

    get resourceUri(): Uri {
        return Uri.file(this.resourcePath);
    }

    constructor() {
        this.uuid = uuidv4();
        this.kind = FavoriteKind.undefined;
        this.resourcePath = '';
        this.label = '';
    }

    toTreeItem(): TreeItem {
        let item = new TreeItem(this.label, TreeItemCollapsibleState.None);
        item.label = this.label;
        item.resourceUri = this.resourceUri;
        item.iconPath = FavoriteKind.file === this.kind ? ThemeIcon.File : ThemeIcon.Folder;
        item.tooltip = this.resourcePath;
        item.command = {
            command: 'fav.openResource',
            arguments: [item.resourceUri],
            title: 'Open Favorite'
        };
        return item;
    }
}

export enum FavoriteKind {
    undefined = 0,
    group,
    file,
    folder
}