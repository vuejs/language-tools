import type * as ts from 'typescript';
import {
	TextDocument,
	WorkspaceEdit,
	Position,
} from 'vscode-languageserver/node';
import { uriToFsPath, fsPathToUri } from '@volar/shared';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, position: Position, newText: string): WorkspaceEdit | undefined => {
		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		try {
			const entries = languageService.findRenameLocations(fileName, offset, false, false, true);
			if (!entries) return;

			const locations = locationsToWorkspaceEdit(newText, entries, getTextDocument);
			return locations;
		} catch {
			return;
		}
	};
}

function locationsToWorkspaceEdit(newText: string, locations: readonly ts.RenameLocation[], getTextDocument: (uri: string) => TextDocument | undefined) {
	const workspaceEdit: WorkspaceEdit = {
		changes: {}
	}

	for (const location of locations) {
		const uri = fsPathToUri(location.fileName);
		const doc = getTextDocument(uri);
		if (!doc) continue;

		if (!workspaceEdit.changes![uri]) {
			workspaceEdit.changes![uri] = [];
		}

		let _newText = newText;
		if (location.prefixText)
			_newText = location.prefixText + _newText;
		if (location.suffixText)
			_newText = _newText + location.suffixText;

		workspaceEdit.changes![uri].push({
			newText: _newText,
			range: {
				start: doc.positionAt(location.textSpan.start),
				end: doc.positionAt(location.textSpan.start + location.textSpan.length),
			},
		})
	}

	return workspaceEdit;
}
