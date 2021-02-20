import type * as ts from 'typescript';
import {
	Location,
	Range,
	LocationLink,
} from 'vscode-languageserver/node';
import { fsPathToUri } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function entriesToLocations(entries: { fileName: string, textSpan: ts.TextSpan }[], getTextDocument: (uri: string) => TextDocument | undefined) {
	const locations: Location[] = [];
	for (const entry of entries) {
		const entryUri = fsPathToUri(entry.fileName);
		const doc = getTextDocument(entryUri);
		if (!doc) continue;
		const range = Range.create(
			doc.positionAt(entry.textSpan.start),
			doc.positionAt(entry.textSpan.start + entry.textSpan.length),
		);
		const uri = fsPathToUri(entry.fileName);
		const location = Location.create(uri, range);
		locations.push(location);
	}
	return locations;
}
export function entriesToLocationLinks(entries: ts.DefinitionInfo[], getTextDocument: (uri: string) => TextDocument | undefined): LocationLink[] {
	const locations: LocationLink[] = [];
	for (const entry of entries) {
		const entryUri = fsPathToUri(entry.fileName);
		const doc = getTextDocument(entryUri);
		if (!doc) continue;
		const targetSelectionRange = Range.create(
			doc.positionAt(entry.textSpan.start),
			doc.positionAt(entry.textSpan.start + entry.textSpan.length),
		);
		const targetRange = entry.contextSpan ? Range.create(
			doc.positionAt(entry.contextSpan.start),
			doc.positionAt(entry.contextSpan.start + entry.contextSpan.length),
		) : targetSelectionRange;
		const originSelectionRange = entry.originalTextSpan ? Range.create(
			doc.positionAt(entry.originalTextSpan.start),
			doc.positionAt(entry.originalTextSpan.start + entry.originalTextSpan.length),
		) : undefined;
		const uri = fsPathToUri(entry.fileName);
		const location = LocationLink.create(uri, targetRange, targetSelectionRange, originSelectionRange);
		locations.push(location);
	}
	return locations;
}
export function boundSpanToLocationLinks(info: ts.DefinitionInfoAndBoundSpan, originalDoc: TextDocument, getTextDocument: (uri: string) => TextDocument | undefined): LocationLink[] {
	const locations: LocationLink[] = [];
	if (!info.definitions) return locations;
	const originSelectionRange = Range.create(
		originalDoc.positionAt(info.textSpan.start),
		originalDoc.positionAt(info.textSpan.start + info.textSpan.length),
	);
	for (const entry of info.definitions) {
		const entryUri = fsPathToUri(entry.fileName);
		const doc = getTextDocument(entryUri);
		if (!doc) continue;
		const targetSelectionRange = Range.create(
			doc.positionAt(entry.textSpan.start),
			doc.positionAt(entry.textSpan.start + entry.textSpan.length),
		);
		const targetRange = entry.contextSpan ? Range.create(
			doc.positionAt(entry.contextSpan.start),
			doc.positionAt(entry.contextSpan.start + entry.contextSpan.length),
		) : targetSelectionRange;
		const uri = fsPathToUri(entry.fileName);
		const location = LocationLink.create(uri, targetRange, targetSelectionRange, originSelectionRange);
		locations.push(location);
	}
	return locations;
}
