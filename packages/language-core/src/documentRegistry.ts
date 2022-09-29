import { Mapping, SourceMapBase } from '@volar/source-map';
import { computed, shallowReactive } from '@vue/reactivity';
import { Teleport } from './sourceMaps';
import type { EmbeddedFile, EmbeddedLanguageModule, SourceFile } from './types';

export function forEachEmbeddeds(input: EmbeddedFile[], cb: (embedded: EmbeddedFile) => void) {
	for (const child of input) {
		if (child) {
			cb(child);
		}
		forEachEmbeddeds(child.embeddeds, cb);
	}
}

export type DocumentRegistry = ReturnType<typeof createDocumentRegistry>;

export function createDocumentRegistry() {

	const files = shallowReactive<Record<string, [SourceFile, EmbeddedLanguageModule]>>({});
	const all = computed(() => Object.values(files));
	const fileNames = computed(() => all.value.map(sourceFile => sourceFile?.[0].fileName));
	const embeddedDocumentsMap = computed(() => {
		const map = new WeakMap<EmbeddedFile, SourceFile>();
		for (const [sourceFile] of all.value) {
			forEachEmbeddeds(sourceFile.embeddeds, embedded => {
				map.set(embedded, sourceFile);
			});
		}
		return map;
	});
	const sourceMapsByFileName = computed(() => {
		const map = new Map<string, { vueFile: SourceFile, embedded: EmbeddedFile; }>();
		for (const [sourceFile] of all.value) {
			forEachEmbeddeds(sourceFile.embeddeds, embedded => {
				map.set(normalizePath(embedded.fileName), { vueFile: sourceFile, embedded });
			});
		}
		return map;
	});
	const teleports = computed(() => {
		const map = new Map<string, Teleport>();
		for (const key in files) {
			const [sourceFile] = files[key]!;
			forEachEmbeddeds(sourceFile.embeddeds, embedded => {
				if (embedded.teleportMappings) {
					map.set(normalizePath(embedded.fileName), getTeleport(sourceFile, embedded.teleportMappings));
				}
			});
		}
		return map;
	});
	const _sourceMaps = new WeakMap<SourceFile, WeakMap<Mapping<any>[], SourceMapBase<any>>>();
	const _teleports = new WeakMap<SourceFile, WeakMap<Mapping<any>[], Teleport>>();

	return {
		get: (fileName: string): [SourceFile, EmbeddedLanguageModule] | undefined => files[normalizePath(fileName)],
		delete: (fileName: string) => delete files[normalizePath(fileName)],
		has: (fileName: string) => !!files[normalizePath(fileName)],
		set: (fileName: string, vueFile: SourceFile, languageModule: EmbeddedLanguageModule) => files[normalizePath(fileName)] = [vueFile, languageModule],

		getFileNames: () => fileNames.value,
		getAll: () => all.value,

		getTeleport: (fileName: string) => teleports.value.get(normalizePath(fileName)),
		getAllEmbeddeds: function* () {
			for (const sourceMap of sourceMapsByFileName.value) {
				yield sourceMap[1];
			}
		},

		fromEmbeddedLocation: function* (fileName: string, offset: number) {

			if (fileName.endsWith('/__VLS_types.ts')) { // TODO: monkey fix
				return;
			}

			const mapped = sourceMapsByFileName.value.get(normalizePath(fileName));

			if (mapped) {

				const sourceMap = getSourceMap(mapped.vueFile, mapped.embedded.mappings);

				for (const vueRange of sourceMap.toSourceOffsets(offset)) {
					yield {
						fileName: mapped.vueFile.fileName,
						offset: vueRange[0],
						mapping: vueRange[1],
						sourceMap,
					};
				}
			}
			else {
				yield {
					fileName,
					offset,
				};
			}
		},
		fromEmbeddedFile: function (file: EmbeddedFile) {
			return embeddedDocumentsMap.value.get(file);
		},
		fromEmbeddedFileName: function (fileName: string) {
			return sourceMapsByFileName.value.get(normalizePath(fileName));
		},
		getSourceMap,
		// TODO: unuse this
		onSourceFileUpdated(file: SourceFile) {
			_sourceMaps.delete(file);
			_teleports.delete(file);
		},
	};

	function getSourceMap(file: SourceFile, mappings: Mapping<any>[]) {
		let map1 = _sourceMaps.get(file);
		if (!map1) {
			map1 = new WeakMap();
			_sourceMaps.set(file, map1);
		}
		let map2 = map1.get(mappings);
		if (!map2) {
			map2 = new SourceMapBase(mappings);
			map1.set(mappings, map2);
		}
		return map2;
	}
	function getTeleport(file: SourceFile, mappings: Mapping<any>[]) {
		let map1 = _teleports.get(file);
		if (!map1) {
			map1 = new WeakMap();
			_teleports.set(file, map1);
		}
		let map2 = map1.get(mappings);
		if (!map2) {
			map2 = new Teleport(mappings);
			map1.set(mappings, map2);
		}
		return map2;
	}
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/').toLowerCase();
}
