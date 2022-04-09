import type { EmbeddedFileMappingData } from '@volar/vue-code-gen';
import { computed, shallowReactive } from '@vue/reactivity';
import * as path from 'path';
import * as localTypes from './utils/localTypes';
import type { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';
import { untrack } from './utils/untrack';
import type { Embedded, EmbeddedFile, VueFile } from './vueFile';

export interface VueFiles extends ReturnType<typeof createVueFiles> { }

export function createVueFiles() {

	const vueFiles = shallowReactive<Record<string, VueFile>>({});
	const all = computed(() => Object.values(vueFiles));
	const fileNames = computed(() => all.value.map(sourceFile => sourceFile.fileName));
	const embeddedDocumentsMap = computed(() => {

		const map = new WeakMap<EmbeddedFile, VueFile>();

		for (const sourceFile of all.value) {
			for (const embedded of sourceFile.refs.allEmbeddeds.value) {
				map.set(embedded.file, sourceFile);
			}
		}

		return map;
	});
	const sourceMapsByFileName = computed(() => {
		const map = new Map<string, { vueFile: VueFile, embedded: Embedded }>();
		for (const sourceFile of all.value) {
			for (const embedded of sourceFile.refs.allEmbeddeds.value) {
				map.set(embedded.file.fileName.toLowerCase(), { vueFile: sourceFile, embedded });
			}
		}
		return map
	});
	const teleports = computed(() => {
		const map = new Map<string, Teleport>();
		for (const key in vueFiles) {
			const sourceFile = vueFiles[key]!;
			for (const { file, teleport } of sourceFile.refs.teleports.value) {
				map.set(file.fileName.toLowerCase(), teleport);
			}
		}
		return map;
	});
	const dirs = computed(() => [...new Set(fileNames.value.map(path.dirname))]);

	return {
		get: untrack((fileName: string) => vueFiles[fileName.toLocaleLowerCase()]),
		delete: untrack((fileName: string) => delete vueFiles[fileName.toLocaleLowerCase()]),
		has: untrack((fileName: string) => !!vueFiles[fileName.toLocaleLowerCase()]),
		set: untrack((fileName: string, vueFile: VueFile) => vueFiles[fileName.toLocaleLowerCase()] = vueFile),

		getFileNames: untrack(() => fileNames.value),
		getDirs: untrack(() => dirs.value),
		getAll: untrack(() => all.value),

		getTeleport: untrack((fileName: string) => teleports.value.get(fileName.toLowerCase())),
		getEmbeddeds: untrack(function* () {
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
