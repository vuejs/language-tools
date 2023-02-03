import * as vue from '@volar/vue-language-core';
import { TextDocument } from 'vscode-languageserver-textdocument';

declare module '@volar/language-service' {
	interface RuleContext {
		vue?: {
			version: 'alpha',
			sfc: vue.Sfc;
			blocksClearedDocument: TextDocument;
		};
	}
}
