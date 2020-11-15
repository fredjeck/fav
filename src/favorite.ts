import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export class Favorite {
    kind: FavoriteKind;
    resourcePath: string;
    label: string;
    uuid: string;
    children: Favorite[] = [];
    parent?: string;

    get description(): string | undefined {
        return this.label !== this.resourcePath ? this.resourcePath : undefined;
    }

    get resourceUri(): Uri {
        return Uri.file(this.resourcePath);
    }

    constructor() {
        this.uuid = uuidv4();
        this.kind = FavoriteKind.Undefined;
        this.resourcePath = '';
        this.label = '';
    }

    toTreeItem(): TreeItem {
        if (FavoriteKind.File === this.kind) {
            let item = new TreeItem(this.label, TreeItemCollapsibleState.None );
            item.label = this.label;
            item.resourceUri = this.resourceUri;
            item.iconPath = ThemeIcon.File ;
            item.tooltip =  this.resourcePath;
            item.command = {
                command: 'fav.context.openResource',
                arguments: [item.resourceUri],
                title: 'Open Favorite'
            };
            return item;
        } else {
            let item = new TreeItem(this.label, TreeItemCollapsibleState.Collapsed);
            item.label = this.label;
            item.iconPath = ThemeIcon.Folder;
            item.contextValue = 'group';
            return item;
        }
    }
}

export enum FavoriteKind {
    Undefined = 0,
    Group,
    File
}