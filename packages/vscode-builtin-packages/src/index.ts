import * as path from 'upath';

let typescript: typeof import('typescript');

export function setTypescript(appRoot: string) {
    const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript');
    typescript = require(path.toUnix(tsPath));
}
export function getTypescript() {
    return typescript;
}
