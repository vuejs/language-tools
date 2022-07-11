import type { EmbeddedFileMappingData } from '@volar/vue-code-gen';
import { computed, shallowReactive } from '@vue/reactivity';
import * as path from 'path';
import * as localTypes from './utils/localTypes';
import type { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';
import { untrack } from './utils/untrack';
import type { Embedded, EmbeddedFile, SourceFile } from './sourceFile';

export interface DocumentRegistry extends ReturnType<typeof createDocumentRegistry> { }

export interface EmbeddedLangaugeSourceFile {
	fileName: string,
	text: string,
	getAllEmbeddeds(): Embedded[],
}

export function createDocumentRegistry() {
	return createDocumentRegistryBase<SourceFile>();
}

function createDocumentRegistryBase<T extends EmbeddedLangaugeSourceFile>() {

	const files = shallowReactive<Record<string, T>>({});
	const arr = computed(() => Object.values(files));
	const fileNames = computed(() => arr.value.map(sourceFile => sourceFile.fileName));
	const embeddedDocumentsMap = computed(() => {
		const map = new WeakMap<EmbeddedFile, T>();
		for (const sourceFile of arr.value) {
			for (const embedded of sourceFile.getAllEmbeddeds()) {
				map.set(embedded.file, sourceFile);
			}
		}
		return map;
	});
	const sourceMapsByFileName = computed(() => {
		const map = new Map<string, { vueFile: T, embedded: Embedded; }>();
		for (const sourceFile of arr.value) {
			for (const embedded of sourceFile.getAllEmbeddeds()) {
				map.set(embedded.file.fileName.toLowerCase(), { vueFile: sourceFile, embedded });
			}
		}
		return map;
	});
	const teleports = computed(() => {
		const map = new Map<string, Teleport>();
		for (const key in files) {
			const sourceFile = files[key]!;
			for (const embedded of sourceFile.getAllEmbeddeds()) {
				if (embedded.teleport) {
					map.set(embedded.file.fileName.toLowerCase(), embedded.teleport);
				}
			}
		}
		return map;
	});
	const dirs = computed(() => [...new Set(fileNames.value.map(path.dirname))]);

	return {
		get: untrack((fileName: string) => files[fileName.toLowerCase()]),
		delete: untrack((fileName: string) => delete files[fileName.toLowerCase()]),
		has: untrack((fileName: string) => !!files[fileName.toLowerCase()]),
		set: untrack((fileName: string, vueFile: T) => files[fileName.toLowerCase()] = vueFile),

		getFileNames: untrack(() => fileNames.value),
		getDirs: untrack(() => dirs.value),
		getAll: untrack(() => arr.value),

		getTeleport: untrack((fileName: string) => teleports.value.get(fileName.toLowerCase())),
		getAllEmbeddeds: untrack(function* () {
			for (const sourceMap of sourceMapsByFileName.value) {
				yield sourceMap[1];
			}
		}),

		fromEmbeddedLocation: untrack(function* (
			fileName: string,
			start: number,
			end?: number,
			filter?: (data: EmbeddedFileMappingData) => boolean,
			sourceMapFilter?: (sourceMap: EmbeddedFileSourceMap) => boolean,
		) {

			if (fileName.endsWith(`/${localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			const mapped = sourceMapsByFileName.value.get(fileName.toLowerCase());

			if (mapped) {

				if (sourceMapFilter && !sourceMapFilter(mapped.embedded.sourceMap))
					return;

				for (const vueRange of mapped.embedded.sourceMap.getSourceRanges(start, end, filter)) {
					yield {
						fileName: mapped.vueFile.fileName,
						range: vueRange[0],
						mapped: mapped,
						data: vueRange[1],
					};
				}
			}
			else {
				yield {
					fileName,
					range: {
						start,
						end,
					},
				};
			}
		}),
		fromEmbeddedFile: untrack(function (
			file: EmbeddedFile,
		) {
			return embeddedDocumentsMap.value.get(file);
		}),
		fromEmbeddedFileName: untrack(function (
			fileName: string,
		) {
			return sourceMapsByFileName.value.get(fileName.toLowerCase());
		}),
	};
}
