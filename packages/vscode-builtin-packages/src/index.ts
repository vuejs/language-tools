let typescript: typeof import('typescript');

export function setTypescript(appRoot: string) {
    typescript = require(appRoot + '/extensions/node_modules/typescript');
}
export function getTypescript() {
    return typescript;
}
