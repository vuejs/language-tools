import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import * as vscode from 'vscode-languageserver';
import { allFilesReg, vueFileReg } from '../features/shared';

export function register(
	connection: vscode.Connection,
	features: NonNullable<shared.ServerInitializationOptions['languageFeatures']>,
	legend: vscode.SemanticTokensLegend,
) {
	if (features.references) {
		const enabledInTsScript = typeof features.references === 'object' ? features.references.enabledInTsScript : false;
		connection.client.register(vscode.ReferencesRequest.type, enabledInTsScript ? allFilesReg : vueFileReg);
	}
	if (features.definition) {
		const enabledInTsScript = typeof features.definition === 'object' ? features.definition.enabledInTsScript : false;
		connection.client.register(vscode.DefinitionRequest.type, enabledInTsScript ? allFilesReg : vueFileReg);
	}
	if (features.typeDefinition) {
		const enabledInTsScript = typeof features.typeDefinition === 'object' ? features.typeDefinition.enabledInTsScript : false;
		connection.client.register(vscode.TypeDefinitionRequest.type, enabledInTsScript ? allFilesReg : vueFileReg);
	}
	if (features.callHierarchy) {
		const enabledInTsScript = typeof features.callHierarchy === 'object' ? features.callHierarchy.enabledInTsScript : false;
		connection.client.register(vscode.CallHierarchyPrepareRequest.type, enabledInTsScript ? allFilesReg : vueFileReg);
	}
	if (features.hover) {
		connection.client.register(vscode.HoverRequest.type, vueFileReg);
	}
	if (features.rename) {
		connection.client.register(vscode.RenameRequest.type, {
			documentSelector: vueFileReg.documentSelector,
			prepareProvider: true,
		});
	}
	if (features.signatureHelp) {
		connection.client.register(vscode.SignatureHelpRequest.type, {
			documentSelector: vueFileReg.documentSelector,
			triggerCharacters: ['(', ',', '<'],
			retriggerCharacters: [')'],
		});
	}
	if (features.completion) {
		connection.client.register(vscode.CompletionRequest.type, {
			documentSelector: vueFileReg.documentSelector,
			triggerCharacters: [
				...vue.triggerCharacter.typescript,
				...vue.triggerCharacter.html,
				...vue.triggerCharacter.css,
				...vue.triggerCharacter.json,
			],
			resolveProvider: true,
		});
		connection.client.register(vscode.ExecuteCommandRequest.type, {
			commands: [
				vue.Commands.CONVERT_TO_KEBAB_CASE,
				vue.Commands.CONVERT_TO_PASCAL_CASE,
			]
		});
	}
	if (features.documentHighlight) {
		connection.client.register(vscode.DocumentHighlightRequest.type, vueFileReg);
	}
	if (features.documentLink) {
		connection.client.register(vscode.DocumentLinkRequest.type, vueFileReg);
	}
	if (features.codeLens) {
		connection.client.register(vscode.CodeLensRequest.type, {
			documentSelector: allFilesReg.documentSelector,
			resolveProvider: true,
		});
		connection.client.register(vscode.ExecuteCommandRequest.type, {
			commands: [
				vue.Commands.HTML_TO_PUG,
				vue.Commands.PUG_TO_HTML,
				vue.Commands.USE_REF_SUGAR,
				vue.Commands.UNUSE_REF_SUGAR,
				vue.Commands.SHOW_REFERENCES,
			]
		});
	}
	if (features.semanticTokens) {
		connection.client.register(vscode.SemanticTokensRegistrationType.type, {
			documentSelector: vueFileReg.documentSelector,
			range: true,
			full: false,
			legend,
		});
	}
	if (features.codeAction) {
		connection.client.register(vscode.CodeActionRequest.type, {
			documentSelector: vueFileReg.documentSelector,
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
		});
	}
}
