import {
	Position,
	Range,
	TextDocument,
	Location,
} from 'vscode-languageserver';
import type { SourceFile } from '../sourceFiles';
import * as ts from '@volar/vscode-typescript-languageservice';

export function notEmpty<T>(value: T): value is NonNullable<T> {
	return value !== null && value !== undefined;
}
export function duplicateLocations(locations: Location[]): Location[] {
	const temp: any = {};
	for (const loc of locations)
		temp[loc.uri + ':' + loc.range.start.line + ':' + loc.range.start.character + ':' + loc.range.end.line + ':' + loc.range.end.character] = loc;
	return Object.values(temp);
}
export function getTsActionEntries(
	document: TextDocument,
	range: Range,
	vueTag: string,
	mode: 'rename' | 'reference' | 'definition',
	worker: (document: TextDocument, position: Position) => Location[],
	ls: ts.LanguageService,
	sourceFiles: Map<string, SourceFile>,
) {
	let insideEntries: Location[] = [];
	let outsideEntries: Location[] = [];

	const _outsideEntries = findOutsideEntries(
		document,
		range.start,
		vueTag,
		Location.create(document.uri, range),
	);
	if (_outsideEntries.length) {
		outsideEntries = outsideEntries.concat(_outsideEntries);
	}
	else if (vueTag === 'template') {
		insideEntries.push(Location.create(document.uri, range));
	}

	for (const outsideEntry of outsideEntries) {
		const document = ls.getTextDocument(outsideEntry.uri);
		if (!document) continue;
		const offset = document.offsetAt(outsideEntry.range.start);
		insideEntries = insideEntries.concat(findIntsideLocations(outsideEntry.uri, offset, ls));
	}

	return [
		...insideEntries,
		...outsideEntries,
	];

	function findOutsideEntries(document: TextDocument, position: Position, vueTag: string, startLoc: Location): Location[] {
		let entries = worker(document, position);

		if (!entries.length && vueTag === 'template' && mode === 'definition') {
			// patch prop definition
			entries = ls.findReferences(document, position);
		}

		for (const entry of entries) {
			const sourceFile = findSourceFileByTsUri(sourceFiles, entry.uri);
			if (!sourceFile) continue;
			const templateScript = sourceFile.getTemplateScript();
			if (!templateScript) continue;

			/* props */
			if (entry.uri === templateScript.document.uri) {
				let left = templateScript.propSourceMap.findSource(entry.range)?.range;
				if (!left && templateScript.propSourceMap.isSource(entry.range)) {
					left = entry.range;
				}
				if (left) {
					const rights = templateScript.propSourceMap.findTargets(left);
					let result = rights.map(right => Location.create(entry.uri, right.range));
					{ // patch prop rename
						let isProp = false;
						for (const right of rights) {
							if (right.data.isUnwrapProp) {
								const loc2Definitions = ls.findDefinition(document, right.range.start);
								isProp = loc2Definitions && loc2Definitions.length > 0;
							}
						}
						if (isProp) {
							for (const right of rights) {
								if (!right.data.isUnwrapProp) {
									const propRenameReferences = ls.findReferences(document, right.range.start);
									if (propRenameReferences) {
										result = result.concat(propRenameReferences);
									}
								}
							}
						}
					}
					return result;
				}
			}

			/* components */
			if (entry.uri === templateScript.document.uri) {
				let left = templateScript.componentSourceMap.findSource(entry.range)?.range;
				if (!left && templateScript.componentSourceMap.isSource(entry.range)) {
					left = entry.range;
				}
				if (left) {
					const rights = templateScript.componentSourceMap.findTargets(left);
					const result = rights.map(right => Location.create(entry.uri, right.range));
					return result;
				}
			}
		}

		if (vueTag === 'template') {
			const otherEntry = entries.find(entry => entry.uri !== document.uri);
			if (otherEntry) {
				return [otherEntry];
			}
		}
		else {
			return [startLoc];
		}

		return [];
	}
	function findIntsideLocations(uri: string, offset: number, ls: ts.LanguageService): Location[] {
		const _document = ls.getTextDocument(uri);
		if (!_document) return [];
		const document = _document!;
		const position = document.positionAt(offset);

		const locations = worker(document, position);
		const insideEntries: Location[] = [];

		for (const entry of locations) {
			const sourceFile = findSourceFileByTsUri(sourceFiles, entry.uri);
			if (!sourceFile) continue;
			const templateScript = sourceFile.getTemplateScript();
			if (!templateScript) continue;
			if (entry.uri !== templateScript.document.uri) continue;
			{ // props
				const left = templateScript.propSourceMap.findSource(entry.range);
				if (left) {
					insideEntries.push(Location.create(entry.uri, left.range));
				}
			}
			{ // components
				const left = templateScript.componentSourceMap.findSource(entry.range);
				if (left) {
					insideEntries.push(Location.create(entry.uri, left.range));
				}
			}
		}

		return insideEntries;
	}
}
export function getSourceTsLocations(location: Location, sourceFiles: Map<string, SourceFile>): Location[] {
	const sourceFile = findSourceFileByTsUri(sourceFiles, location.uri);
	if (!sourceFile)
		return [location]; // not virtual ts script

	const result: Location[] = [];

	for (const sourceMap of sourceFile.getTsSourceMaps()) {
		if (sourceMap.targetDocument.uri !== location.uri) continue;
		const vueLoc = sourceMap.findSource(location.range);
		if (vueLoc) {
			const sourceLocation = Location.create(sourceMap.sourceDocument.uri, vueLoc.range)
			result.push(sourceLocation);
		}
	}

	return result;
}
export function findSourceFileByTsUri(sourceFiles: Map<string, SourceFile>, uri: string) {
	for (const sourceFile of sourceFiles.values()) {
		if (sourceFile.getTsUris().has(uri)) {
			return sourceFile;
		}
	}
	return undefined;
}
export function isStartWithText(document: TextDocument, position: Position, text: string) {
	return document.getText(Range.create(document.positionAt(document.offsetAt(position) - text.length), position)) === text;
}
