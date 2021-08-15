import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function entriesToLocations(entries: { fileName: string, textSpan: ts.TextSpan }[], getTextDocument: (uri: string) => TextDocument | undefined) {
	const locations: vscode.Location[] = [];
	for (const entry of entries) {
		const entryUri = shared.fsPathToUri(entry.fileName);
		const doc = getTextDocument(entryUri);
		if (!doc) continue;
		const range = vscode.Range.create(
			doc.positionAt(entry.textSpan.start),
			doc.positionAt(entry.textSpan.start + entry.textSpan.length),
		);
		const uri = shared.fsPathToUri(entry.fileName);
		const location = vscode.Location.create(uri, range);
		locations.push(location);
	}
	return locations;
}
export function entriesToLocationLinks(entries: ts.DefinitionInfo[], getTextDocument: (uri: string) => TextDocument | undefined): vscode.LocationLink[] {
	const locations: vscode.LocationLink[] = [];
	for (const entry of entries) {
		const entryUri = shared.fsPathToUri(entry.fileName);
		const doc = getTextDocument(entryUri);
		if (!doc) continue;
		const targetSelectionRange = vscode.Range.create(
			doc.positionAt(entry.textSpan.start),
			doc.positionAt(entry.textSpan.start + entry.textSpan.length),
		);
		const targetRange = entry.contextSpan ? vscode.Range.create(
			doc.positionAt(entry.contextSpan.start),
			doc.positionAt(entry.contextSpan.start + entry.contextSpan.length),
		) : targetSelectionRange;
		const originSelectionRange = entry.originalTextSpan ? vscode.Range.create(
			doc.positionAt(entry.originalTextSpan.start),
			doc.positionAt(entry.originalTextSpan.start + entry.originalTextSpan.length),
		) : undefined;
		const uri = shared.fsPathToUri(entry.fileName);
		const location = vscode.LocationLink.create(uri, targetRange, targetSelectionRange, originSelectionRange);
		locations.push(location);
	}
	return locations;
}
export function boundSpanToLocationLinks(info: ts.DefinitionInfoAndBoundSpan, originalDoc: TextDocument, getTextDocument: (uri: string) => TextDocument | undefined): vscode.LocationLink[] {
	const locations: vscode.LocationLink[] = [];
	if (!info.definitions) return locations;
	const originSelectionRange = vscode.Range.create(
		originalDoc.positionAt(info.textSpan.start),
		originalDoc.positionAt(info.textSpan.start + info.textSpan.length),
	);
	for (const entry of info.definitions) {
		const entryUri = shared.fsPathToUri(entry.fileName);
		const doc = getTextDocument(entryUri);
		if (!doc) continue;
		const targetSelectionRange = vscode.Range.create(
			doc.positionAt(entry.textSpan.start),
			doc.positionAt(entry.textSpan.start + entry.textSpan.length),
		);
		const targetRange = entry.contextSpan ? vscode.Range.create(
			doc.positionAt(entry.contextSpan.start),
			doc.positionAt(entry.contextSpan.start + entry.contextSpan.length),
		) : targetSelectionRange;
		const uri = shared.fsPathToUri(entry.fileName);
		const location = vscode.LocationLink.create(uri, targetRange, targetSelectionRange, originSelectionRange);
		locations.push(location);
	}
	return locations;
}
