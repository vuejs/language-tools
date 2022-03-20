import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function entriesToLocations(entries: { fileName: string, textSpan: ts.TextSpan }[], getTextDocument: (uri: string) => TextDocument | undefined) {
	const locations: vscode.Location[] = [];
	for (const entry of entries) {
		const doc = getTextDocument(entry.fileName);
		if (!doc) continue;
		const range = vscode.Range.create(
			doc.positionAt(entry.textSpan.start),
			doc.positionAt(entry.textSpan.start + entry.textSpan.length),
		);
		const location = vscode.Location.create(entry.fileName, range);
		locations.push(location);
	}
	return locations;
}
export function entriesToLocationLinks<T extends ts.DocumentSpan>(entries: T[], getTextDocument: (uri: string) => TextDocument | undefined): vscode.LocationLink[] {
	const locations: vscode.LocationLink[] = [];
	for (const entry of entries) {
		const doc = getTextDocument(entry.fileName);
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
		const location = vscode.LocationLink.create(entry.fileName, targetRange, targetSelectionRange, originSelectionRange);
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
		const doc = getTextDocument(entry.fileName);
		if (!doc) continue;
		const targetSelectionRange = vscode.Range.create(
			doc.positionAt(entry.textSpan.start),
			doc.positionAt(entry.textSpan.start + entry.textSpan.length),
		);
		const targetRange = entry.contextSpan ? vscode.Range.create(
			doc.positionAt(entry.contextSpan.start),
			doc.positionAt(entry.contextSpan.start + entry.contextSpan.length),
		) : targetSelectionRange;
		const location = vscode.LocationLink.create(entry.fileName, targetRange, targetSelectionRange, originSelectionRange);
		locations.push(location);
	}
	return locations;
}
