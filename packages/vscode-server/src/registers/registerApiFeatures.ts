import * as vue from 'vscode-vue-languageservice';
import * as vscode from 'vscode-languageserver';
import {
	allFilesReg,
	vueFileReg
} from '../features/shared';

export function register(connection: vscode.Connection, enableFindReferencesInTsScript: boolean) {
	connection.client.register(vscode.ReferencesRequest.type, enableFindReferencesInTsScript ? allFilesReg : vueFileReg);
	connection.client.register(vscode.DefinitionRequest.type, vueFileReg /* enabledTsPlugin ? vueFileReg : allFilesReg */);
	connection.client.register(vscode.CallHierarchyPrepareRequest.type, allFilesReg); // TODO: vueFileReg
	connection.client.register(vscode.TypeDefinitionRequest.type, vueFileReg);
	connection.client.register(vscode.HoverRequest.type, vueFileReg);
	connection.client.register(vscode.RenameRequest.type, {
		documentSelector: vueFileReg.documentSelector,
		prepareProvider: true,
	});
	connection.client.register(vscode.SelectionRangeRequest.type, vueFileReg);
	connection.client.register(vscode.SignatureHelpRequest.type, {
		documentSelector: vueFileReg.documentSelector,
		triggerCharacters: ['(', ',', '<'],
		retriggerCharacters: [')'],
	});
	connection.client.register(vscode.ExecuteCommandRequest.type, {
		commands: [
			vue.Commands.HTML_TO_PUG,
			vue.Commands.PUG_TO_HTML,
			vue.Commands.USE_REF_SUGAR,
			vue.Commands.UNUSE_REF_SUGAR,
			vue.Commands.SHOW_REFERENCES,
			vue.Commands.CONVERT_TO_KEBAB_CASE,
			vue.Commands.CONVERT_TO_PASCAL_CASE,
		]
	});
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
}
