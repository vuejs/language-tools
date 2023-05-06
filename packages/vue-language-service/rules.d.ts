import type * as vue from '@vue/language-core';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { VueLanguagePlugin } from '@vue/language-core';

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
