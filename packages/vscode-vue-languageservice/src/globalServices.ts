import * as CSS from 'vscode-css-languageservice';
import * as HTML from 'vscode-html-languageservice';

export const html = HTML.getLanguageService();
export const css = CSS.getCSSLanguageService();
export const scss = CSS.getSCSSLanguageService();
export const less = CSS.getLESSLanguageService();

export function getCssService(lang: string) {
    switch (lang) {
        case 'css': return css;
        case 'scss': return scss;
        case 'less': return less;
        default: return css;
    }
}
