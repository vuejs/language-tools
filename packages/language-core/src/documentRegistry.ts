import type { FileNode, EmbeddedLanguageModule, DocumentCapabilities, PositionCapabilities } from './types';
import { computed, shallowReactive } from '@vue/reactivity';
import { Teleport } from './sourceMaps';
import { Mapping, SourceMapBase } from '@volar/source-map';

export function forEachEmbeddeds(input: FileNode, cb: (embedded: FileNode) => void) {
	cb(input);
	for (const child of input.embeddeds) {
		if (child) {
			cb(child);
		}
		forEachEmbeddeds(child, cb);
	}
}

export type DocumentRegistry = ReturnType<typeof createDocumentRegistry>;

export function createDocumentRegistry() {

	const files = shallowReactive<Record<string, [FileNode, EmbeddedLanguageModule]>>({});
	const all = computed(() => Object.values(files));
	const fileNames = computed(() => all.value.map(sourceFile => sourceFile?.[0].fileName));
	const embeddedDocumentsMap = computed(() => {
		const map = new WeakMap<FileNode, FileNode>();
		for (const [sourceFile] of all.value) {
			forEachEmbeddeds(sourceFile, embedded => {
				map.set(embedded, sourceFile);
			});
		}
		return map;
	});
	const sourceMapsByFileName = computed(() => {
		const map = new Map<string, { vueFile: FileNode, embedded: FileNode; }>();
		for (const [sourceFile] of all.value) {
			forEachEmbeddeds(sourceFile, embedded => {
				map.set(embedded.fileName.toLowerCase(), { vueFile: sourceFile, embedded });
			});
		}
		return map;
	});
	const teleports = computed(() => {
		const map = new Map<string, Teleport>();
		for (const key in files) {
			const [sourceFile] = files[key]!;
			forEachEmbeddeds(sourceFile, embedded => {
				if (embedded.teleportMappings) {
					map.set(embedded.fileName.toLowerCase(), getTeleport(embedded.teleportMappings));
				}
			});
		}
		return map;
	});
	const _sourceMaps = new WeakMap<Mapping<any>[], SourceMapBase<any>>();
	const _teleports = new WeakMap<Mapping<any>[], Teleport>();

	return {
		get: (fileName: string): [FileNode, EmbeddedLanguageModule] | undefined => files[fileName.toLowerCase()],
		delete: (fileName: string) => delete files[fileName.toLowerCase()],
		has: (fileName: string) => !!files[fileName.toLowerCase()],
		set: (fileName: string, vueFile: FileNode, languageModule: EmbeddedLanguageModule) => files[fileName.toLowerCase()] = [vueFile, languageModule],

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
			filter?: (data: PositionCapabilities) => boolean,
			sourceMapFilter?: (sourceMap: DocumentCapabilities) => boolean,
		) {

			if (fileName.endsWith('/__VLS_types.ts')) { // TODO: monkey fix
				return;
			}

			if (end === undefined)
				end = start;

			const mapped = sourceMapsByFileName.value.get(fileName.toLowerCase());

			if (mapped) {

				if (sourceMapFilter && !sourceMapFilter(mapped.embedded.capabilities))
					return;

				const sourceMap = getSourceMap(mapped.embedded.mappings);

				for (const vueRange of sourceMap.getSourceRanges(start, end, filter)) {
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
		fromEmbeddedFile: function (file: FileNode) {
			return embeddedDocumentsMap.value.get(file);
		},
		fromEmbeddedFileName: function (fileName: string) {
			return sourceMapsByFileName.value.get(fileName.toLowerCase());
		},
		getSourceMap,
		getTeleportSourceMap: getTeleport,
	};

	function getSourceMap(mappings: Mapping<any>[]) {
		if (!_sourceMaps.has(mappings)) {
			_sourceMaps.set(mappings, new SourceMapBase(mappings));
		}
		return _sourceMaps.get(mappings)!;
	}
	function getTeleport(mappings: Mapping<any>[]) {
		if (!_teleports.has(mappings)) {
			_teleports.set(mappings, new Teleport(mappings));
		}
		return _teleports.get(mappings)!;
	}
}
