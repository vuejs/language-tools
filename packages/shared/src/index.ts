export * from './path';
export * from './requests';

export function sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function extNameToLanguageId(extName: string) {
    switch (extName) {
        case 'js': return 'javascript';
        case 'ts': return 'typescript';
        case 'jsx': return 'javascriptreact';
        case 'tsx': return 'typescriptreact';
        case 'pug': return 'jade';
    }
    return extName;
}
export function languageIdToExtName(languageId: string) {
    switch (languageId) {
        case 'javascript': return 'js';
        case 'typescript': return 'ts';
        case 'javascriptreact': return 'jsx';
        case 'typescriptreact': return 'tsx';
        case 'jade': return 'pug';
    }
    return languageId;
}
export function randomStr() {
    return [...Array(10)].map(i=>(~~(Math.random()*36)).toString(36)).join('');
}
