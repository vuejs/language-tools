import type * as ts from 'typescript';
import {
	Location,
	Range,
	TextDocument,
} from 'vscode-languageserver/node';
import { fsPathToUri } from '@volar/shared';

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
