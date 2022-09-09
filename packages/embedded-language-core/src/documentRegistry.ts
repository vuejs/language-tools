import type { EmbeddedFileMappingData, EmbeddedLangaugeSourceFile, EmbeddedLanguageModule } from './types';
import { computed, shallowReactive } from '@vue/reactivity';
import type { EmbeddedFileSourceMap, Teleport } from './sourceMaps';
import type { Embedded, EmbeddedFile, EmbeddedStructure } from './types';

export function forEachEmbeddeds(input: EmbeddedStructure[], cb: (embedded: Embedded) => void) {
	for (const child of input) {
		if (child.self) {
			cb(child.self);
		}
		forEachEmbeddeds(child.embeddeds, cb);
	}
}

export type DocumentRegistry = ReturnType<typeof createDocumentRegistry>;

export function createDocumentRegistry() {

	const files = shallowReactive<Record<string, [EmbeddedLangaugeSourceFile, EmbeddedLanguageModule]>>({});
	const all = computed(() => Object.values(files));
	const fileNames = computed(() => all.value.map(sourceFile => sourceFile?.[0].fileName));
	const embeddedDocumentsMap = computed(() => {
		const map = new WeakMap<EmbeddedFile, EmbeddedLangaugeSourceFile>();
		for (const [sourceFile] of all.value) {
			forEachEmbeddeds(sourceFile.embeddeds, embedded => {
				map.set(embedded.file, sourceFile);
			});
		}
		return map;
	});
	const sourceMapsByFileName = computed(() => {
		const map = new Map<string, { vueFile: EmbeddedLangaugeSourceFile, embedded: Embedded; }>();
		for (const [sourceFile] of all.value) {
			forEachEmbeddeds(sourceFile.embeddeds, embedded => {
				map.set(embedded.file.fileName.toLowerCase(), { vueFile: sourceFile, embedded });
			});
		}
		return map;
	});
	const teleports = computed(() => {
		const map = new Map<string, Teleport>();
		for (const key in files) {
			const [sourceFile] = files[key]!;
			forEachEmbeddeds(sourceFile.embeddeds, embedded => {
				if (embedded.teleport) {
					map.set(embedded.file.fileName.toLowerCase(), embedded.teleport);
				}
			});
		}
		return map;
	});

	return {
		get: (fileName: string): [EmbeddedLangaugeSourceFile, EmbeddedLanguageModule] | undefined => files[fileName.toLowerCase()],
		delete: (fileName: string) => delete files[fileName.toLowerCase()],
		has: (fileName: string) => !!files[fileName.toLowerCase()],
		set: (fileName: string, vueFile: EmbeddedLangaugeSourceFile, languageModule: EmbeddedLanguageModule) => files[fileName.toLowerCase()] = [vueFile, languageModule],

		getFileNames: () => fileNames.value,
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

			if (fileName.endsWith('/__VLS_types.ts')) { // TODO: monkey fix
				return;
			}

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
