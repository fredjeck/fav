import { sep } from 'path';

export class Utils {
    /**
     * Cheap function to retrieve a file name from a given path.
     * @param filePath A file path
     */
    static fileName(filePath: string): string {
        return filePath.split(sep).pop() || filePath;
    }
}