import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'upath';
import { renameInfoOptions } from './prepareRename';
import type { LanguageServiceHost } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {

	return async (uri: string, position: vscode.Position, newName: string): Promise<vscode.WorkspaceEdit | undefined> => {
		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = shared.uriToFsPath(document.uri);
		const offset = document.offsetAt(position);

		let renameInfo: ReturnType<typeof languageService.getRenameInfo> | undefined;
		try { renameInfo = languageService.getRenameInfo(fileName, offset, renameInfoOptions); } catch { }
		if (!renameInfo?.canRename) return;

		if (renameInfo.fileToRename) {
			const [formatOptions, preferences] = await Promise.all([
				host.getFormatOptions?.(document) ?? {},
				host.getPreferences?.(document) ?? {},
			]);
			return renameFile(renameInfo.fileToRename, newName, formatOptions, preferences);
		}

		const { providePrefixAndSuffixTextForRename } = await host.getPreferences?.(document) ?? { providePrefixAndSuffixTextForRename: true };
		const entries = languageService.findRenameLocations(fileName, offset, false, false, providePrefixAndSuffixTextForRename);
		if (!entries)
			return;

		const locations = locationsToWorkspaceEdit(newName, entries, getTextDocument);
		return locations;
	};

	function renameFile(
		fileToRename: string,
		newName: string,
		formatOptions: ts.FormatCodeSettings,
		preferences: ts.UserPreferences,
	): vscode.WorkspaceEdit | undefined {
		// Make sure we preserve file extension if none provided
		if (!path.extname(newName)) {
			newName += path.extname(fileToRename);
		}

		const dirname = path.dirname(fileToRename);
		const newFilePath = path.join(dirname, newName);

		const response = languageService.getEditsForFileRename(fileToRename, newFilePath, formatOptions, preferences);
		const edits = fileTextChangesToWorkspaceEdit(response, getTextDocument);
		if (!edits.documentChanges) {
			edits.documentChanges = [];
		}

		edits.documentChanges.push(vscode.RenameFile.create(
			shared.fsPathToUri(fileToRename),
			shared.fsPathToUri(newFilePath),
		));

		return edits;
	}
}

export function fileTextChangesToWorkspaceEdit(changes: readonly ts.FileTextChanges[], getTextDocument: (uri: string) => TextDocument | undefined) {
	const workspaceEdit: vscode.WorkspaceEdit = {};

	for (const change of changes) {

		if (!workspaceEdit.documentChanges) {
			workspaceEdit.documentChanges = [];
		}

		const uri = shared.fsPathToUri(change.fileName);
		let doc = getTextDocument(uri);

		if (change.isNewFile) {
			workspaceEdit.documentChanges.push(vscode.CreateFile.create(uri));
			doc = TextDocument.create(uri, 'typescript', 0, '');
		}

		if (!doc)
			continue;

		const docEdit = vscode.TextDocumentEdit.create(
			{ uri: uri, version: doc.version },
			[],
		);

		for (const textChange of change.textChanges) {
			docEdit.edits.push({
				newText: textChange.newText,
				range: {
					start: doc.positionAt(textChange.span.start),
					end: doc.positionAt(textChange.span.start + textChange.span.length),
				},
			})
		}
		workspaceEdit.documentChanges.push(docEdit);
	}

	return workspaceEdit;
}
function locationsToWorkspaceEdit(newText: string, locations: readonly ts.RenameLocation[], getTextDocument: (uri: string) => TextDocument | undefined) {
	const workspaceEdit: vscode.WorkspaceEdit = {};

	for (const location of locations) {

		if (!workspaceEdit.changes) {
			workspaceEdit.changes = {};
		}

		const uri = shared.fsPathToUri(location.fileName);
		const doc = getTextDocument(uri);
		if (!doc) continue;

		if (!workspaceEdit.changes[uri]) {
			workspaceEdit.changes[uri] = [];
		}

		let _newText = newText;
		if (location.prefixText)
			_newText = location.prefixText + _newText;
		if (location.suffixText)
			_newText = _newText + location.suffixText;

		workspaceEdit.changes[uri].push({
			newText: _newText,
			range: {
				start: doc.positionAt(location.textSpan.start),
				end: doc.positionAt(location.textSpan.start + location.textSpan.length),
			},
		});
	}

	return workspaceEdit;
}
