import { computed, shallowReactive } from '@vue/reactivity';
import type * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from './sourceFile';
import type { EmbeddedDocumentSourceMap, TeleportSourceMap } from './utils/sourceMaps';
import { untrack } from './utils/untrack';
import * as shared from '@volar/shared';
import * as path from 'upath';
import * as localTypes from './utils/localTypes';
import type { EmbeddedDocumentMappingData } from '@volar/vue-code-gen';
import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix build failed

export interface SourceFiles extends ReturnType<typeof createSourceFiles> { }

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
		values: () => new Set(Object.values(_sourceFiles)).values(),
	});

	const all = computed(() => Object.values(_sourceFiles));
	const uris = computed(() => all.value.map(sourceFile => sourceFile.uri));
	const sourceMapsById = computed(() => {
		const map = new Map<string, EmbeddedDocumentSourceMap>();
		for (const key in _sourceFiles) {
			const sourceFile = _sourceFiles[key]!;
			for (const sourceMap of sourceFile.refs.sourceMaps.value) {
				map.set(sourceMap.id + ':' + sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const embeddedDocumentsMap = computed(() => {

		const map = new Map<TextDocument, SourceFile>();

		for (const sourceFile of all.value) {
			for (const sourceMap of sourceFile.refs.sourceMaps.value) {
				map.set(sourceMap.mappedDocument, sourceFile);
			}
		}

		return map;
	});
	const sourceMapsByUriAndLsType = computed(() => {

		const noLsType = new Map<string, EmbeddedDocumentSourceMap>();
		const script = new Map<string, EmbeddedDocumentSourceMap>();
		const template = new Map<string, EmbeddedDocumentSourceMap>();

		for (const sourceFile of all.value) {
			for (const sourceMap of sourceFile.refs.sourceMaps.value) {
				if (sourceMap.lsType === undefined) {
					noLsType.set(sourceMap.mappedDocument.uri, sourceMap);
				}
				else if (sourceMap.lsType === 'script') {
					script.set(sourceMap.mappedDocument.uri, sourceMap);
				}
				else if (sourceMap.lsType === 'template') {
					template.set(sourceMap.mappedDocument.uri, sourceMap);
				}
			}
		}

		return {
			noLsType,
			script,
			template,
		};
	});
	const cssSourceMaps = computed(() => {
		const map = new Map<string, EmbeddedDocumentSourceMap>();
		for (const key in _sourceFiles) {
			const sourceFile = _sourceFiles[key]!;
			for (const sourceMap of sourceFile.refs.cssLsSourceMaps.value) {
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const htmlSourceMaps = computed(() => {
		const map = new Map<string, EmbeddedDocumentSourceMap>();
		for (const key in _sourceFiles) {
			const sourceFile = _sourceFiles[key]!;
			if (sourceFile.refs.sfcTemplate.textDocument.value?.languageId === 'html' && sourceFile.refs.sfcTemplate.sourceMap.value) {
				const sourceMap = sourceFile.refs.sfcTemplate.sourceMap.value;
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
				const map = new Map<string, EmbeddedDocumentSourceMap>();
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
				const map = new Map<string, EmbeddedDocumentSourceMap>();
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

		getSourceMap: untrack((id: number, embeddedDocumentUri: string) => sourceMapsById.value.get(id + ':' + embeddedDocumentUri)),

		getTsTeleports: untrack((lsType: 'script' | 'template') => tsRefs[lsType].teleports.value),
		getTsDocuments: untrack((lsType: 'script' | 'template') => tsRefs[lsType].documents.value),
		getTsSourceMaps: untrack((lsType: 'script' | 'template') => tsRefs[lsType].sourceMaps.value),
		getSourceFileByTsUri: untrack((lsType: 'script' | 'template', uri: string) => tsRefs[lsType].urisMapSourceFiles.value.get(uri)),
		getCssSourceMaps: untrack(() => cssSourceMaps.value),
		getHtmlSourceMaps: untrack(() => htmlSourceMaps.value),

		toTsLocations: untrack(function* (
			uri: string,
			start: vscode.Position,
			end?: vscode.Position,
			filter?: (data: EmbeddedDocumentMappingData) => boolean,
			sourceMapFilter?: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
		) {

			if (end === undefined)
				end = start;

			for (const lsType of ['script', 'template'] as const) {
				const sourceFile = sourceFiles.uriGet(uri);
				if (sourceFile) {
					for (const sourceMap of lsType === 'script' ? sourceFile.refs.scriptLsSourceMaps.value : sourceFile.refs.templateLsSourceMaps.value) {

						if (sourceMapFilter && !sourceMapFilter(sourceMap))
							continue;

						for (const tsRange of sourceMap.getMappedRanges(start, end, filter)) {
							yield {
								lsType,
								type: 'embedded-ts' as const,
								sourceMap,
								uri: sourceMap.mappedDocument.uri,
								range: tsRange[0],
								data: tsRange[1],
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
		fromEmbeddedLocation: untrack(function* (
			lsType: 'script' | 'template' | undefined,
			uri: string,
			start: vscode.Position,
			end?: vscode.Position,
			filter?: (data: EmbeddedDocumentMappingData) => boolean,
			sourceMapFilter?: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
		) {

			if (uri.endsWith(`/${localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			let sourceMap = sourceMapsByUriAndLsType.value.noLsType.get(uri);

			if (!sourceMap) {
				if (lsType === 'script') {
					sourceMap = sourceMapsByUriAndLsType.value.script.get(uri);
				}
				else if (lsType === 'template') {
					sourceMap = sourceMapsByUriAndLsType.value.template.get(uri);
				}
			}

			if (sourceMap) {

				if (sourceMapFilter && !sourceMapFilter(sourceMap))
					return;

				for (const vueRange of sourceMap.getSourceRanges(start, end, filter)) {
					yield {
						type: 'embedded-ts' as const,
						sourceMap,
						uri: sourceMap.sourceDocument.uri,
						range: vueRange[0],
						data: vueRange[1],
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
		fromEmbeddedDocument: untrack(function (
			document: TextDocument,
		) {
			return embeddedDocumentsMap.value.get(document);
		}),
		fromTsLocation: untrack(function* (
			lsType: 'script' | 'template',
			uri: string,
			start: vscode.Position,
			end?: vscode.Position,
			filter?: (data: EmbeddedDocumentMappingData) => boolean,
			sourceMapFilter?: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
		) {

			if (uri.endsWith(`/${localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			const sourceMap = tsRefs[lsType].sourceMaps.value.get(uri);
			if (sourceMap) {

				if (sourceMapFilter && !sourceMapFilter(sourceMap))
					return;

				for (const vueRange of sourceMap.getSourceRanges(start, end, filter)) {
					yield {
						type: 'embedded-ts' as const,
						sourceMap,
						uri: sourceMap.sourceDocument.uri,
						range: vueRange[0],
						data: vueRange[1],
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
		fromTsLocation2: untrack(function* (
			lsType: 'script' | 'template',
			uri: string,
			start: number,
			end?: number,
			filter?: (data: EmbeddedDocumentMappingData) => boolean,
			sourceMapFilter?: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
		) {

			if (uri.endsWith(`/${localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			const sourceMap = tsRefs[lsType].sourceMaps.value.get(uri);
			if (sourceMap) {

				if (sourceMapFilter && !sourceMapFilter(sourceMap))
					return;

				for (const vueRange of sourceMap.getSourceRanges(start, end, filter)) {
					yield {
						type: 'embedded-ts' as const,
						sourceMap,
						uri: sourceMap.sourceDocument.uri,
						range: vueRange[0],
						data: vueRange[1],
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
