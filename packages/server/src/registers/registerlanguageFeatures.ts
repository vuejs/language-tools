import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import * as vscode from 'vscode-languageserver';
import { Commands } from '../commands';

export function register(
	features: NonNullable<shared.ServerInitializationOptions['languageFeatures']>,
	legend: vscode.SemanticTokensLegend,
	server: vscode.ServerCapabilities,
	tsVersion: string,
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
						{ pattern: { glob: '**/*.vue' } },
						{ pattern: { glob: '**/*.js' } },
						{ pattern: { glob: '**/*.ts' } },
						{ pattern: { glob: '**/*.jsx' } },
						{ pattern: { glob: '**/*.tsx' } },
						{ pattern: { glob: '**/*.json' } },
					]
				}
			}
		}
	}
	if (features.signatureHelp) {
		server.signatureHelpProvider = {
			triggerCharacters: ['(', ',', '<'],
			retriggerCharacters: [')'],
		};
	}
	if (features.completion) {
		const triggerCharacters = vue.getTriggerCharacters(tsVersion);
		server.completionProvider = {
			triggerCharacters: Object.values(triggerCharacters).flat(),
			resolveProvider: true,
		};
		server.executeCommandProvider = {
			commands: [
				...(server.executeCommandProvider?.commands ?? []),
				Commands.CONVERT_TO_KEBAB_CASE,
				Commands.CONVERT_TO_PASCAL_CASE,
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
				Commands.HTML_TO_PUG,
				Commands.PUG_TO_HTML,
				Commands.USE_SETUP_SUGAR,
				Commands.UNUSE_SETUP_SUGAR,
				Commands.USE_REF_SUGAR,
				Commands.UNUSE_REF_SUGAR,
				Commands.SHOW_REFERENCES,
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
}
