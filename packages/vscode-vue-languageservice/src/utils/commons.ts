import {
	Position,
	Range,
	TextDocument,
	Location,
	CallHierarchyIncomingCall,
	CallHierarchyOutgoingCall,
} from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFiles';
import type { TsMappingData, TsSourceMap } from '../utils/sourceMaps';

export function notEmpty<T>(value: T): value is NonNullable<T> {
	return value !== null && value !== undefined;
}
export function duplicateLocations<T extends Location>(locations: T[]): T[] {
	const temp: any = {};
	for (const loc of locations)
		temp[loc.uri + ':' + loc.range.start.line + ':' + loc.range.start.character + ':' + loc.range.end.line + ':' + loc.range.end.character] = loc;
	return Object.values(temp);
}
export function duplicateCallHierarchyIncomingCall(locations: CallHierarchyIncomingCall[]): CallHierarchyIncomingCall[] {
	const temp: any = {};
	for (const loc of locations)
		temp[loc.from.uri + ':' + loc.from.range.start.line + ':' + loc.from.range.start.character + ':' + loc.from.range.end.line + ':' + loc.from.range.end.character] = loc;
	return Object.values(temp);
}
export function duplicateCallHierarchyOutgoingCall(locations: CallHierarchyOutgoingCall[]): CallHierarchyOutgoingCall[] {
	const temp: any = {};
	for (const loc of locations)
		temp[loc.to.uri + ':' + loc.to.range.start.line + ':' + loc.to.range.start.character + ':' + loc.to.range.end.line + ':' + loc.to.range.end.character] = loc;
	return Object.values(temp);
}
export function duplicateRanges<T extends Range>(ranges: T[]): T[] {
	const temp: any = {};
	for (const range of ranges)
		temp[range.start.line + ':' + range.start.character + ':' + range.end.line + ':' + range.end.character] = range;
	return Object.values(temp);
}
export function tsLocationToVueLocations(location: Location, sourceFiles: Map<string, SourceFile>, globalTsSourceMaps?: Map<string, { sourceMap: TsSourceMap }>): Location[] {
	return tsLocationToVueLocationsRaw(location, sourceFiles, globalTsSourceMaps).map(loc => loc[0]);
}
export function tsLocationToVueLocationsRaw(location: Location, sourceFiles: Map<string, SourceFile>, globalTsSourceMaps?: Map<string, { sourceMap: TsSourceMap }>): [Location, TsMappingData | undefined][] {
	// patch global components call
	const globalTs = globalTsSourceMaps?.get(location.uri);
	if (globalTs) {
		const tsLoc2 = globalTs.sourceMap.targetToSource(location.range);
		if (tsLoc2) {
			location.range = tsLoc2.range;
		}
	}

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
