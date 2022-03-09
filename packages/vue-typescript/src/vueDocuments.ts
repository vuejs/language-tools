import { computed, shallowReactive } from '@vue/reactivity';
import type * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { VueDocument } from './vueDocument';
import type { EmbeddedDocumentSourceMap, TeleportSourceMap } from './utils/sourceMaps';
import { untrack } from './utils/untrack';
import * as shared from '@volar/shared';
import * as path from 'upath';
import * as localTypes from './utils/localTypes';
import type { EmbeddedDocumentMappingData } from '@volar/vue-code-gen';
import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix build failed

export interface VueDocuments extends ReturnType<typeof createVueDocuments> { }

export function createVueDocuments() {

	const _vueDocuments = shallowReactive<Record<string, VueDocument>>({});
	const vueDocuments = shared.createPathMap<VueDocument>({
		delete: key => delete _vueDocuments[key],
		get: key => _vueDocuments[key],
		has: key => !!_vueDocuments[key],
		set: (key, value) => _vueDocuments[key] = value,
		clear: () => {
			for (var key in _vueDocuments) {
				if (_vueDocuments.hasOwnProperty(key)) {
					delete _vueDocuments[key];
				}
			}
		},
		values: () => new Set(Object.values(_vueDocuments)).values(),
	});

	const all = computed(() => Object.values(_vueDocuments));
	const uris = computed(() => all.value.map(sourceFile => sourceFile.uri));
	const sourceMapsById = computed(() => {
		const map = new Map<string, EmbeddedDocumentSourceMap>();
		for (const key in _vueDocuments) {
			const sourceFile = _vueDocuments[key]!;
			for (const sourceMap of sourceFile.refs.sourceMaps.value) {
				map.set(sourceMap.id + ':' + sourceMap.mappedDocument.uri, sourceMap);
			}
		}
		return map;
	});
	const embeddedDocumentsMap = computed(() => {

		const map = new WeakMap<TextDocument, VueDocument>();

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
				if (sourceMap.lsType === 'nonTs') {
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
	const tsTeleports = {
		template: computed(() => {
			const map = new Map<string, TeleportSourceMap>();
			for (const key in _vueDocuments) {
				const sourceFile = _vueDocuments[key]!;
				for (const sourceMap of sourceFile.refs.templateLsTeleports.value) {
					map.set(sourceMap.mappedDocument.uri, sourceMap);
				}
			}
			return map;
		}),
		script: computed(() => {
			const map = new Map<string, TeleportSourceMap>();
			for (const key in _vueDocuments) {
				const sourceFile = _vueDocuments[key]!;
				const sourceMap = sourceFile.refs.sfcScriptForScriptLs.teleportSourceMap.value;
				map.set(sourceMap.mappedDocument.uri, sourceMap);
			}
			return map;
		}),
	};
	const dirs = computed(() => [...new Set(uris.value.map(shared.uriToFsPath).map(path.dirname))]);

	return {
		getUris: untrack(() => uris.value),
		getDirs: untrack(() => dirs.value),
		getAll: untrack(() => all.value),
		get: untrack(vueDocuments.uriGet),
		set: untrack(vueDocuments.uriSet),
		delete: untrack(vueDocuments.uriDelete),

		getSourceMap: untrack((id: number, embeddedDocumentUri: string) => sourceMapsById.value.get(id + ':' + embeddedDocumentUri)),

		getTsTeleports: untrack((lsType: 'script' | 'template') => tsTeleports[lsType].value),
		getEmbeddeds: untrack(function* (
			lsType: 'script' | 'template' | 'nonTs',
		) {
			if (lsType === 'nonTs') {
				for (const sourceMap of sourceMapsByUriAndLsType.value.noLsType) {
					yield sourceMap[1];
				}
			}
			else if (lsType === 'script') {
				for (const sourceMap of sourceMapsByUriAndLsType.value.script) {
					yield sourceMap[1];
				}
			}
			else if (lsType === 'template') {
				for (const sourceMap of sourceMapsByUriAndLsType.value.template) {
					yield sourceMap[1];
				}
			}
		}),

		fromEmbeddedLocation: untrack(function* <T extends vscode.Position | number>(
			lsType: 'script' | 'template' | 'nonTs',
			uri: string,
			start: T,
			end?: T,
			filter?: (data: EmbeddedDocumentMappingData) => boolean,
			sourceMapFilter?: (sourceMap: EmbeddedDocumentSourceMap) => boolean,
		) {

			if (uri.endsWith(`/${localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			let sourceMap: EmbeddedDocumentSourceMap | undefined;

			if (lsType === 'nonTs') {
				sourceMap = sourceMapsByUriAndLsType.value.noLsType.get(uri);
			}
			else if (lsType === 'script') {
				sourceMap = sourceMapsByUriAndLsType.value.script.get(uri);
			}
			else if (lsType === 'template') {
				sourceMap = sourceMapsByUriAndLsType.value.template.get(uri);
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
		fromEmbeddedDocumentUri: untrack(function (
			lsType: 'script' | 'template' | 'nonTs',
			uri: string,
		) {
			if (lsType === 'nonTs') {
				return sourceMapsByUriAndLsType.value.noLsType.get(uri);
			}
			else if (lsType === 'script') {
				return sourceMapsByUriAndLsType.value.script.get(uri);
			}
			else if (lsType === 'template') {
				return sourceMapsByUriAndLsType.value.template.get(uri);
			}
		}),
	};
}
