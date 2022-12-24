import { Mapping, SourceMapBase } from '@volar/source-map';
import { computed, shallowReactive as reactive } from '@vue/reactivity';
import { Teleport } from './sourceMaps';
import type { VirtualFile, LanguageModule, PositionCapabilities, TeleportMappingData } from './types';

export function forEachEmbeddeds(file: VirtualFile, cb: (embedded: VirtualFile) => void) {
	cb(file);
	for (const child of file.embeddeds) {
		forEachEmbeddeds(child, cb);
	}
}

export type DocumentRegistry = ReturnType<typeof createVirtualFilesHost>;

type Row = [string, ts.IScriptSnapshot, VirtualFile, LanguageModule];

export function createVirtualFilesHost(languageModules: LanguageModule[]) {

	const files = reactive<Record<string, Row>>({});
	const all = computed(() => Object.values(files));
	const sourceMapsByFileName = computed(() => {
		const map = new Map<string, [VirtualFile, Row]>();
		for (const row of all.value) {
			forEachEmbeddeds(row[2], file => {
				map.set(normalizePath(file.fileName), [file, row]);
			});
		}
		return map;
	});
	const teleports = computed(() => {
		const map = new Map<string, Teleport>();
		for (const key in files) {
			const [_1, _2, sourceFile] = files[key]!;
			forEachEmbeddeds(sourceFile, embedded => {
				if (embedded.teleportMappings) {
					const _map = getTeleport(embedded);
					if (_map) {
						map.set(normalizePath(embedded.fileName), _map);
					}
				}
			});
		}
		return map;
	});
	const _sourceMaps = new WeakMap<ts.IScriptSnapshot, WeakMap<Mapping<PositionCapabilities>[], SourceMapBase<PositionCapabilities>>>();
	const _teleports = new WeakMap<ts.IScriptSnapshot, WeakMap<Mapping<TeleportMappingData>[], Teleport>>();

	return {
		update(fileName: string, snapshot: ts.IScriptSnapshot | undefined) {
			const key = normalizePath(fileName);
			if (snapshot) {
				if (files[key]) {
					const virtualFile = files[key][2];
					files[key][1] = snapshot;
					files[key][3].updateSourceFile(virtualFile, snapshot);
					return virtualFile; // updated
				}
				for (const languageModule of languageModules) {
					const virtualFile = languageModule.createSourceFile(fileName, snapshot);
					if (virtualFile) {
						files[key] = [fileName, snapshot, reactive(virtualFile), languageModule];
						return virtualFile; // created
					}
				}
			}
			delete files[key]; // deleted
		},
		get(fileName: string) {
			const key = normalizePath(fileName);
			if (files[key]) {
				return [
					files[key][1],
					files[key][2],
				] as const;
			}
		},
		has: (fileName: string) => !!files[normalizePath(fileName)],
		all: () => all.value,
		getTeleport: (fileName: string) => teleports.value.get(normalizePath(fileName)),
		getSourceMap,
		getSourceByVirtualFileName(fileName: string) {
			const source = sourceMapsByFileName.value.get(normalizePath(fileName));
			if (source) {
				return [
					source[1][0],
					source[1][1],
					source[0],
				] as const;
			}
		},
	};

	function getSourceMap(file: VirtualFile) {
		const snapshot = sourceMapsByFileName.value.get(normalizePath(file.fileName))![1][1];
		let map1 = _sourceMaps.get(snapshot);
		if (!map1) {
			map1 = new WeakMap();
			_sourceMaps.set(snapshot, map1);
		}
		let map2 = map1.get(file.mappings);
		if (!map2) {
			map2 = new SourceMapBase(file.mappings);
			map1.set(file.mappings, map2);
		}
		return map2;
	}

	function getTeleport(file: VirtualFile) {
		const snapshot = sourceMapsByFileName.value.get(normalizePath(file.fileName))![1][1];
		let map1 = _teleports.get(snapshot);
		if (!map1) {
			map1 = new WeakMap();
			_teleports.set(snapshot, map1);
		}
		if (file.teleportMappings) {
			let map2 = map1.get(file.teleportMappings);
			if (!map2) {
				map2 = new Teleport(file.teleportMappings);
				map1.set(file.teleportMappings, map2);
			}
			return map2;
		}
	}
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/').toLowerCase();
}
