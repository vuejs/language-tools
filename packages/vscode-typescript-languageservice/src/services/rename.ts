import type * as ts from 'typescript';
import {
	WorkspaceEdit,
	Position,
	CreateFile,
	RenameFile,
	TextDocumentEdit,
} from 'vscode-languageserver/node';
import { uriToFsPath, fsPathToUri } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'upath';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {

	return (uri: string, position: Position, newName: string): WorkspaceEdit | undefined => {
		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);

		const renameInfo = languageService.getRenameInfo(fileName, offset, { allowRenameOfImportPath: true });
		if (!renameInfo.canRename)
			return;

		if (renameInfo.fileToRename) {
			return renameFile(renameInfo.fileToRename, newName);
		}

		const entries = languageService.findRenameLocations(fileName, offset, false, false, true);
		if (!entries)
			return;

		const locations = locationsToWorkspaceEdit(newName, entries, getTextDocument);
		return locations;
	};

	function renameFile(
		fileToRename: string,
		newName: string,
	): WorkspaceEdit | undefined {
		// Make sure we preserve file extension if none provided
		if (!path.extname(newName)) {
			newName += path.extname(fileToRename);
		}

		const dirname = path.dirname(fileToRename);
		const newFilePath = path.join(dirname, newName);

		const response = languageService.getEditsForFileRename(fileToRename, newFilePath, {}, { allowTextChangesInNewFiles: true });
		const edits = fileTextChangesToWorkspaceEdit(response, getTextDocument);
		if (!edits.documentChanges) {
			edits.documentChanges = [];
		}

		edits.documentChanges.push(RenameFile.create(
			fsPathToUri(fileToRename),
			fsPathToUri(newFilePath),
		));

		return edits;
	}
}

export function fileTextChangesToWorkspaceEdit(changes: readonly ts.FileTextChanges[], getTextDocument: (uri: string) => TextDocument | undefined) {
	const workspaceEdit: WorkspaceEdit = {};

	for (const change of changes) {

		if (!workspaceEdit.documentChanges) {
			workspaceEdit.documentChanges = [];
		}

		const uri = fsPathToUri(change.fileName);
		if (change.isNewFile) {
			workspaceEdit.documentChanges.push(CreateFile.create(uri));
		}

		const doc = getTextDocument(uri);
		if (!doc)
			continue;

		const docEdit = TextDocumentEdit.create(
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
	const workspaceEdit: WorkspaceEdit = {};

	for (const location of locations) {

		if (!workspaceEdit.changes) {
			workspaceEdit.changes = {};
		}

		const uri = fsPathToUri(location.fileName);
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
