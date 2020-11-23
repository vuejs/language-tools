import {
	Position,
	Range,
	TextDocument,
	Location,
} from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFiles';
import type { TsMappingData } from '../utils/sourceMaps';

export function notEmpty<T>(value: T): value is NonNullable<T> {
	return value !== null && value !== undefined;
}
export function duplicateLocations(locations: Location[]): Location[] {
	const temp: any = {};
	for (const loc of locations)
		temp[loc.uri + ':' + loc.range.start.line + ':' + loc.range.start.character + ':' + loc.range.end.line + ':' + loc.range.end.character] = loc;
	return Object.values(temp);
}
export function tsLocationToVueLocations(location: Location, sourceFiles: Map<string, SourceFile>): Location[] {
	return tsLocationToVueLocationsRaw(location, sourceFiles).map(loc => loc[0]);
}
export function tsLocationToVueLocationsRaw(location: Location, sourceFiles: Map<string, SourceFile>): [Location, TsMappingData | undefined][] {
	const sourceFile = findSourceFileByTsUri(sourceFiles, location.uri);
	if (!sourceFile)
		return [[location, undefined]]; // not virtual ts script

	const result: [Location, TsMappingData][] = [];

	for (const sourceMap of sourceFile.getTsSourceMaps()) {
		if (sourceMap.targetDocument.uri !== location.uri) continue;
		const vueLocs = sourceMap.targetToSources(location.range);
		for (const vueLoc of vueLocs) {
			const sourceLocation = Location.create(sourceMap.sourceDocument.uri, vueLoc.range)
			result.push([sourceLocation, vueLoc.maped.data]);
		}
	}

	return result;
}
export function findSourceFileByTsUri(sourceFiles: Map<string, SourceFile>, uri: string) {
	for (const sourceFile of sourceFiles.values()) {
		if (sourceFile.getTsDocuments().has(uri)) {
			return sourceFile;
		}
	}
	return undefined;
}
export function isStartWithText(document: TextDocument, position: Position, text: string) {
	return document.getText(Range.create(document.positionAt(document.offsetAt(position) - text.length), position)) === text;
}
export function getWordRange(wordPattern: RegExp, range: Range, document: TextDocument) {
	const docText = document.getText();
	const startOffset = document.offsetAt(range.start);
	const endOffset = document.offsetAt(range.end);
	for (const match of docText.matchAll(wordPattern)) {
		if (match.index === undefined) continue;
		const startIndex = match.index;
		const endIndex = match.index + match[0].length;
		if (startOffset >= startIndex && endOffset <= endIndex) {
			return Range.create(document.positionAt(startIndex), document.positionAt(endIndex));
		}
	}
	return range;
}
