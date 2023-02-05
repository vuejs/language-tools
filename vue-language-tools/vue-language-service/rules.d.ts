import * as vue from '@volar/vue-language-core';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as ts from 'typescript/lib/tsserverlibrary';
import { VueLanguagePlugin } from '@volar/vue-language-core';

declare module '@volar/language-service' {
	interface RuleContext {
		vue?: {
			sfc: NonNullable<vue.VueFile['parsedSfc']>;
			templateAst: vue.Sfc['templateAst'];
			scriptAst: vue.Sfc['scriptAst'];
			scriptSetupAst: vue.Sfc['scriptSetupAst'];
		};
	}
}
