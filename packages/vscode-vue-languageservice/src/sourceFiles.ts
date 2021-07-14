import { computed, shallowReactive } from '@vue/reactivity';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from './sourceFile';
import type { CssSourceMap, HtmlSourceMap, TeleportSourceMap, TsSourceMap } from './utils/sourceMaps';
import { untrack } from './utils/untrack';

export type SourceFiles = ReturnType<typeof createSourceFiles>;

export function createSourceFiles() {

	const sourceFiles = shallowReactive<Record<string, SourceFile>>({});
	const all = computed(() => Object.values(sourceFiles));
	const uris = computed(() => all.value.map(sourceFile => sourceFile.uri));
	const cssSourceMaps = computed(() => {
		const map = new Map<string, CssSourceMap>();
		for (const key in sourceFiles) {
			const sourceFile = sourceFiles[key]!;
			for (const sourceMap of sourceFile.refs.cssSourceMaps.value) {
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const htmlSourceMaps = computed(() => {
		const map = new Map<string, HtmlSourceMap>();
		for (const key in sourceFiles) {
			const sourceFile = sourceFiles[key]!;
			if (sourceFile.refs.htmlSourceMap.value) {
				const sourceMap = sourceFile.refs.htmlSourceMap.value;
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const tsSourceMaps = computed(() => {
		const map = new Map<string, TsSourceMap>();
		for (const key in sourceFiles) {
			const sourceFile = sourceFiles[key]!;
			for (const sourceMap of sourceFile.refs.tsSourceMaps.value) {
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const tsTeleports = computed(() => {
		const map = new Map<string, TeleportSourceMap>();
		for (const key in sourceFiles) {
			const sourceFile = sourceFiles[key]!;
			for (const sourceMap of sourceFile.refs.tsTeleports.value) {
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const tsDocuments = computed(() => {
		const map = new Map<string, TextDocument>();
		for (const key in sourceFiles) {
			const sourceFile = sourceFiles[key]!;
			for (const [_, tsDoc] of sourceFile.refs.tsDocuments.value) {
				map.set(tsDoc.uri, tsDoc);
			}
		}
		return map;
	});
	const tsUrisMapVueUris = computed(() => {
		const map = new Map<string, string>();
		for (const key in sourceFiles) {
			const sourceFile = sourceFiles[key]!;
			map.set(sourceFile.refs.mainTsDocument.value.uri, sourceFile.uri);
		}
		return map;
	});
	const tsUrisMapSourceFiles = computed(() => {
		const map = new Map<string, SourceFile>();
		for (const key in sourceFiles) {
			const sourceFile = sourceFiles[key]!;
			for (const [_, tsDoc] of sourceFile.refs.tsDocuments.value) {
				map.set(tsDoc.uri, sourceFile);
			}
		}
		return map;
	});

	return {
		getUris: untrack(() => uris.value),
		getAll: untrack(() => all.value),
		get: untrack((uri: string) => sourceFiles[uri.toLowerCase()]),
		set: untrack((uri: string, sourceFile: SourceFile) => sourceFiles[uri.toLowerCase()] = sourceFile),
		delete: untrack((uri: string) => {
			if (sourceFiles[uri.toLowerCase()]) {
				delete sourceFiles[uri.toLowerCase()];
				return true;
			}
			return false;
		}),

		getTsTeleports: untrack(() => tsTeleports.value),
		getTsDocuments: untrack(() => tsDocuments.value),
		getTsSourceMaps: untrack(() => tsSourceMaps.value),
		getCssSourceMaps: untrack(() => cssSourceMaps.value),
		getHtmlSourceMaps: untrack(() => htmlSourceMaps.value),
		getVueUriByMainTsUri: untrack((uri: string) => tsUrisMapVueUris.value.get(uri)),
		getSourceFileByTsUri: untrack((uri: string) => tsUrisMapSourceFiles.value.get(uri)),

		toTsLocations: untrack(function* (uri: string, start: Position, end?: Position) {

			if (end === undefined)
				end = start;

			const sourceFile = sourceFiles[uri.toLowerCase()];
			if (sourceFile) {
				for (const sourceMap of sourceFile.getTsSourceMaps()) {
					for (const tsRange of sourceMap.getMappedRanges(start, end)) {
						yield {
							type: 'embedded-ts' as const,
							sourceMap,
							uri: sourceMap.mappedDocument.uri,
							range: tsRange,
						};
					}
				}
			}
			else {
				yield {
					type: 'source-ts' as const,
					uri,
					range: {
						start,
						end,
					},
				};
			}
		}),
		fromTsLocation: untrack(function* (uri: string, start: Position, end?: Position) {

			if (end === undefined)
				end = start;

			const sourceMap = tsSourceMaps.value.get(uri);
			if (sourceMap) {
				for (const vueRange of sourceMap.getSourceRanges(start, end)) {
					yield {
						type: 'embedded-ts' as const,
						sourceMap,
						uri: sourceMap.sourceDocument.uri,
						range: vueRange,
					};
				}
			}
			else {
				yield {
					type: 'source-ts' as const,
					uri,
					range: {
						start,
						end,
					},
				};
			}
		}),
		fromTsLocation2: untrack(function* (uri: string, start: number, end?: number) {

			if (end === undefined)
				end = start;

			const sourceMap = tsSourceMaps.value.get(uri);
			if (sourceMap) {
				for (const vueRange of sourceMap.getSourceRanges2(start, end)) {
					yield {
						type: 'embedded-ts' as const,
						sourceMap,
						uri: sourceMap.sourceDocument.uri,
						range: vueRange,
					};
				}
			}
			else {
				yield {
					type: 'source-ts' as const,
					uri,
					range: {
						start,
						end,
					},
				};
			}
		}),
	};
}
