import type { EmbeddedFileMappingData } from './types';
import { computed, shallowReactive } from '@vue/reactivity';
import { posix as path } from 'path';
import * as localTypes from './utils/localTypes';
import type { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';
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
	const all = computed(() => Object.values(files));
	const fileNames = computed(() => all.value.map(sourceFile => sourceFile.fileName));
	const embeddedDocumentsMap = computed(() => {
		const map = new WeakMap<EmbeddedFile, T>();
		for (const sourceFile of all.value) {
			for (const embedded of sourceFile.getAllEmbeddeds()) {
				map.set(embedded.file, sourceFile);
			}
		}
		return map;
	});
	const sourceMapsByFileName = computed(() => {
		const map = new Map<string, { vueFile: T, embedded: Embedded; }>();
		for (const sourceFile of all.value) {
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
		get: (fileName: string) => files[fileName.toLowerCase()],
		delete: (fileName: string) => delete files[fileName.toLowerCase()],
		has: (fileName: string) => !!files[fileName.toLowerCase()],
		set: (fileName: string, vueFile: T) => files[fileName.toLowerCase()] = vueFile,

		getFileNames: () => fileNames.value,
		getDirs: () => dirs.value,
		getAll: () => all.value,

		getTeleport: (fileName: string) => teleports.value.get(fileName.toLowerCase()),
		getAllEmbeddeds: function* () {
			for (const sourceMap of sourceMapsByFileName.value) {
				yield sourceMap[1];
			}
		},

		fromEmbeddedLocation: function* (
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
		},
		fromEmbeddedFile: function (
			file: EmbeddedFile,
		) {
			return embeddedDocumentsMap.value.get(file);
		},
		fromEmbeddedFileName: function (
			fileName: string,
		) {
			return sourceMapsByFileName.value.get(fileName.toLowerCase());
		},
	};
}
