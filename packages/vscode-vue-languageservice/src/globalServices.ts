import * as CSS from 'vscode-css-languageservice';
import * as HTML from 'vscode-html-languageservice';

export const html = HTML.getLanguageService();
export const css = CSS.getCSSLanguageService();
export const scss = CSS.getSCSSLanguageService();
