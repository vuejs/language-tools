import * as vue from '@volar/vue-language-service';
import { LanguageConfigs, ServerInitializationOptions } from '../types';
import * as vscode from 'vscode-languageserver';

export function register(
	features: NonNullable<ServerInitializationOptions['languageFeatures']>,
	legend: vscode.SemanticTokensLegend,
	server: vscode.ServerCapabilities,
	languageConfigs: LanguageConfigs,
) {
	if (features.references) {
		server.referencesProvider = true;
	}
	if (features.implementation) {
		server.implementationProvider = true;
	}
	if (features.definition) {
		server.definitionProvider = true;
	}
	if (features.typeDefinition) {
		server.typeDefinitionProvider = true;
	}
	if (features.callHierarchy) {
		server.callHierarchyProvider = true;
	}
	if (features.hover) {
		server.hoverProvider = true;
	}
	if (features.rename) {
		server.renameProvider = {
			prepareProvider: true,
		};
	}
	if (features.renameFileRefactoring) {
		server.workspace = {
			fileOperations: {
				willRename: {
					filters: [
						...[...languageConfigs.definitelyExts, ...languageConfigs.indeterminateExts].map(ext => ({ pattern: { glob: `**/*${ext}` } })),
						{ pattern: { glob: '**/*.js' } },
						{ pattern: { glob: '**/*.ts' } },
						{ pattern: { glob: '**/*.jsx' } },
						{ pattern: { glob: '**/*.tsx' } },
						{ pattern: { glob: '**/*.json' } },
					]
				}
			}
		};
	}
	if (features.signatureHelp) {
		server.signatureHelpProvider = {
			triggerCharacters: ['(', ',', '<'],
			retriggerCharacters: [')'],
		};
	}
	if (features.completion) {
		server.completionProvider = {
			// triggerCharacters: '!@#$%^&*()_+-=`~{}|[]\:";\'<>?,./ '.split(''), // all symbols on keyboard
			// hardcode to fix https://github.com/sublimelsp/LSP-volar/issues/114
			triggerCharacters: [...new Set([
				'/', '-', ':', // css
				...'>+^*()#.[]$@-{}'.split(''), // emmet
				'.', ':', '<', '"', '=', '/', // html, vue
				'@', // vue-event
				'"', ':', // json
				'.', '"', '\'', '`', '/', '<', '@', '#', ' ', // typescript
				'*', // typescript-jsdoc
				'@', // typescript-comment
			])],
			resolveProvider: true,
		};
		server.executeCommandProvider = {
			commands: [
				...(server.executeCommandProvider?.commands ?? []),
				'volar.server.convertTagNameCasing',
			]
		};
	}
	if (features.documentHighlight) {
		server.documentHighlightProvider = true;
	}
	if (features.documentLink) {
		server.documentLinkProvider = {
			resolveProvider: false, // TODO
		};
	}
	if (features.workspaceSymbol) {
		server.workspaceSymbolProvider = true;
	}
	if (features.codeLens) {
		server.codeLensProvider = {
			resolveProvider: true,
		};
		server.executeCommandProvider = {
			commands: [
				...(server.executeCommandProvider?.commands ?? []),
				vue.executePluginCommand,
			]
		};
	}
	if (features.semanticTokens) {
		server.semanticTokensProvider = {
			range: true,
			full: false,
			legend,
		};
	}
	if (features.codeAction) {
		server.codeActionProvider = {
			codeActionKinds: [
				vscode.CodeActionKind.Empty,
				vscode.CodeActionKind.QuickFix,
				vscode.CodeActionKind.Refactor,
				vscode.CodeActionKind.RefactorExtract,
				vscode.CodeActionKind.RefactorInline,
				vscode.CodeActionKind.RefactorRewrite,
				vscode.CodeActionKind.Source,
				vscode.CodeActionKind.SourceFixAll,
				vscode.CodeActionKind.SourceOrganizeImports,
			],
			resolveProvider: true,
		};
	}
	if (features.inlayHints) {
		server.inlayHintProvider = true;
	}
	// buggy
	// if (features.diagnostics) {
	// 	server.diagnosticProvider = {
	// 		documentSelector: [
	// 			...languageConfigs.definitelyExts.map(ext => ({ pattern: `**/*${ext}` })),
	// 			...languageConfigs.indeterminateExts.map(ext => ({ pattern: `**/*${ext}` })),
	// 			{ pattern: '**/*.{ts,js,tsx,jsx}' },
	// 		],
	// 		interFileDependencies: true,
	// 		workspaceDiagnostics: false,
	// 	};
	// }
}
