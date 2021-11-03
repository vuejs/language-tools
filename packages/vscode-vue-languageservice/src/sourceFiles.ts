import { computed, shallowReactive } from '@vue/reactivity';
import type * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from './sourceFile';
import type { CssSourceMap, HtmlSourceMap, TeleportSourceMap, TsSourceMap } from './utils/sourceMaps';
import { untrack } from './utils/untrack';
import * as shared from '@volar/shared';
import * as path from 'upath';
import * as localTypes from './utils/localTypes';

export type SourceFiles = ReturnType<typeof createSourceFiles>;

export function createSourceFiles() {

	const _sourceFiles = shallowReactive<Record<string, SourceFile>>({});
	const sourceFiles = shared.createPathMap<SourceFile>({
		delete: key => delete _sourceFiles[key],
		get: key => _sourceFiles[key],
		has: key => !!_sourceFiles[key],
		set: (key, value) => _sourceFiles[key] = value,
		clear: () => {
			for (var key in _sourceFiles) {
				if (_sourceFiles.hasOwnProperty(key)) {
					delete _sourceFiles[key];
				}
			}
		},
	});

	const all = computed(() => Object.values(_sourceFiles));
	const uris = computed(() => all.value.map(sourceFile => sourceFile.uri));
	const cssSourceMaps = computed(() => {
		const map = new Map<string, CssSourceMap>();
		for (const key in _sourceFiles) {
			const sourceFile = _sourceFiles[key]!;
			for (const sourceMap of sourceFile.refs.cssLsSourceMaps.value) {
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const htmlSourceMaps = computed(() => {
		const map = new Map<string, HtmlSourceMap>();
		for (const key in _sourceFiles) {
			const sourceFile = _sourceFiles[key]!;
			if (sourceFile.refs.sfcTemplate.htmlSourceMap.value) {
				const sourceMap = sourceFile.refs.sfcTemplate.htmlSourceMap.value;
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const tsRefs = {
		template: {
			documents: computed(() => {
				const map = new Map<string, TextDocument>();
				for (const key in _sourceFiles) {
					const sourceFile = _sourceFiles[key]!;
					for (const tsDoc of sourceFile.refs.templateLsDocuments.value) {
						map.set(tsDoc.uri, tsDoc);
					}
				}
				return map;
			}),
			teleports: computed(() => {
				const map = new Map<string, TeleportSourceMap>();
				for (const key in _sourceFiles) {
					const sourceFile = _sourceFiles[key]!;
					for (const sourceMap of sourceFile.refs.templateLsTeleports.value) {
						map.set(sourceMap.mappedDocument.uri, sourceMap);
					}
				}
				return map;
			}),
			sourceMaps: computed(() => {
				const map = new Map<string, TsSourceMap>();
				for (const key in _sourceFiles) {
					const sourceFile = _sourceFiles[key]!;
					for (const sourceMap of sourceFile.refs.templateLsSourceMaps.value) {
						map.set(sourceMap.mappedDocument.uri, sourceMap);
					}
				}
				return map;
			}),
			urisMapSourceFiles: computed(() => {
				const map = new Map<string, SourceFile>();
				for (const key in _sourceFiles) {
					const sourceFile = _sourceFiles[key]!;
					for (const tsDoc of sourceFile.refs.templateLsDocuments.value) {
						map.set(tsDoc.uri, sourceFile);
					}
				}
				return map;
			}),
		},
		script: {
			documents: computed(() => {
				const map = new Map<string, TextDocument>();
				for (const key in _sourceFiles) {
					const sourceFile = _sourceFiles[key]!;
					for (const tsDoc of sourceFile.refs.scriptLsDocuments.value) {
						map.set(tsDoc.uri, tsDoc);
					}
				}
				return map;
			}),
			teleports: computed(() => {
				const map = new Map<string, TeleportSourceMap>();
				for (const key in _sourceFiles) {
					const sourceFile = _sourceFiles[key]!;
					const sourceMap = sourceFile.refs.sfcScriptForScriptLs.teleportSourceMap.value;
					map.set(sourceMap.mappedDocument.uri, sourceMap);
				}
				return map;
			}),
			sourceMaps: computed(() => {
				const map = new Map<string, TsSourceMap>();
				for (const key in _sourceFiles) {
					const sourceFile = _sourceFiles[key]!;
					for (const sourceMap of sourceFile.refs.scriptLsSourceMaps.value) {
						map.set(sourceMap.mappedDocument.uri, sourceMap);
					}
				}
				return map;
			}),
			urisMapSourceFiles: computed(() => {
				const map = new Map<string, SourceFile>();
				for (const key in _sourceFiles) {
					const sourceFile = _sourceFiles[key]!;
					for (const tsDoc of sourceFile.refs.scriptLsDocuments.value) {
						map.set(tsDoc.uri, sourceFile);
					}
				}
				return map;
			}),
		},
	};
	const dirs = computed(() => [...new Set(uris.value.map(shared.uriToFsPath).map(path.dirname))]);

	return {
		getUris: untrack(() => uris.value),
		getDirs: untrack(() => dirs.value),
		getAll: untrack(() => all.value),
		get: untrack(sourceFiles.uriGet),
		set: untrack(sourceFiles.uriSet),
		delete: untrack(sourceFiles.uriDelete),

		getTsTeleports: untrack((lsType: 'script' | 'template') => tsRefs[lsType].teleports.value),
		getTsDocuments: untrack((lsType: 'script' | 'template') => tsRefs[lsType].documents.value),
		getTsSourceMaps: untrack((lsType: 'script' | 'template') => tsRefs[lsType].sourceMaps.value),
		getSourceFileByTsUri: untrack((lsType: 'script' | 'template', uri: string) => tsRefs[lsType].urisMapSourceFiles.value.get(uri)),
		getCssSourceMaps: untrack(() => cssSourceMaps.value),
		getHtmlSourceMaps: untrack(() => htmlSourceMaps.value),

		toTsLocations: untrack(function* (uri: string, start: vscode.Position, end?: vscode.Position) {

			if (end === undefined)
				end = start;

			for (const lsType of ['script', 'template'] as const) {
				const sourceFile = sourceFiles.uriGet(uri);
				if (sourceFile) {
					for (const sourceMap of lsType === 'script' ? sourceFile.refs.scriptLsSourceMaps.value : sourceFile.refs.templateLsSourceMaps.value) {
						for (const tsRange of sourceMap.getMappedRanges(start, end)) {
							yield {
								lsType,
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
						lsType,
						type: 'source-ts' as const,
						uri,
						range: {
							start,
							end,
						},
					};
				}
			}
		}),
		fromTsLocation: untrack(function* (lsType: 'script' | 'template', uri: string, start: vscode.Position, end?: vscode.Position) {

			if (uri.endsWith(`/${localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			const sourceMap = tsRefs[lsType].sourceMaps.value.get(uri);
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
		fromTsLocation2: untrack(function* (lsType: 'script' | 'template', uri: string, start: number, end?: number) {

			if (uri.endsWith(`/${localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			const sourceMap = tsRefs[lsType].sourceMaps.value.get(uri);
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
	};
}
