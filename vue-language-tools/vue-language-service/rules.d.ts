import * as vue from '@volar/vue-language-core';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as ts from 'typescript/lib/tsserverlibrary';
import { VueLanguagePlugin } from '@volar/vue-language-core';

declare module '@volar/language-service' {
	interface RuleContext {
		vue?: {
			version: 'alpha',
			modules: {
				typescript: typeof import('typescript/lib/tsserverlibrary');
			},
			sfc: vue.Sfc;
			compilerOptions: ts.CompilerOptions;
			vueCompilerOptions: vue.VueCompilerOptions;
			blocksClearedDocument: TextDocument;
		};
	}
}
