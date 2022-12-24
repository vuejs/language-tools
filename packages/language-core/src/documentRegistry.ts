import { SourceMapBase } from '@volar/source-map';
import { computed, shallowReactive as reactive } from '@vue/reactivity';
import { Teleport } from './sourceMaps';
import type { LanguageModule, PositionCapabilities, VirtualFile } from './types';

export function forEachEmbeddedFile(file: VirtualFile, cb: (embedded: VirtualFile) => void) {
	cb(file);
	for (const embeddedFile of file.embeddedFiles) {
		forEachEmbeddedFile(embeddedFile, cb);
	}
}

export type VirtualFiles = ReturnType<typeof createVirtualFiles>;

type Row = [string, ts.IScriptSnapshot, VirtualFile, LanguageModule];

export function createVirtualFiles(languageModules: LanguageModule[]) {

	const files = reactive<Record<string, Row>>({});
	const all = computed(() => Object.values(files));
	const virtualFileNameToSource = computed(() => {
		const map = new Map<string, [VirtualFile, Row]>();
		for (const row of all.value) {
			forEachEmbeddedFile(row[2], file => {
				map.set(normalizePath(file.fileName), [file, row]);
			});
		}
		return map;
	});
	const virtualFileToSourceMapsMap = new WeakMap<ts.IScriptSnapshot, Map<string, [string, SourceMapBase<PositionCapabilities>]>>();
	const _teleports = new WeakMap<ts.IScriptSnapshot, Teleport | undefined>();

	return {
		update(fileName: string, snapshot: ts.IScriptSnapshot) {
			const key = normalizePath(fileName);
			if (files[key]) {
				const virtualFile = files[key][2];
				files[key][1] = snapshot;
				files[key][3].updateFile(virtualFile, snapshot);
				return virtualFile; // updated
			}
			for (const languageModule of languageModules) {
				const virtualFile = languageModule.createFile(fileName, snapshot);
				if (virtualFile) {
					files[key] = [fileName, snapshot, reactive(virtualFile), languageModule];
					return virtualFile; // created
				}
			}
		},
		delete(fileName: string) {
			const key = normalizePath(fileName);
			if (files[key]) {
				const virtualFile = files[key][2];
				files[key][3].deleteFile?.(virtualFile);
				delete files[key]; // deleted
			}
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
		hasSourceFile: (fileName: string) => !!files[normalizePath(fileName)],
		all: () => all.value,
		getTeleport,
		getMaps: getSourceMaps,
		getSourceByVirtualFileName(fileName: string) {
			const source = virtualFileNameToSource.value.get(normalizePath(fileName));
			if (source) {
				return [
					source[1][0],
					source[1][1],
					source[0],
				] as const;
			}
		},
	};

	function getSourceMaps(virtualFile: VirtualFile) {
		const sourceMapsBySourceFileName = virtualFileToSourceMapsMap.get(virtualFile.snapshot) ?? new Map();
		virtualFileToSourceMapsMap.set(virtualFile.snapshot, sourceMapsBySourceFileName);

		const sources = new Set<string | undefined>();
		for (const map of virtualFile.mappings) {
			sources.add(map.source);
		}

		for (const source of sources) {
			const sourceFileName = source ?? virtualFileNameToSource.value.get(normalizePath(virtualFile.fileName))![1][0];
			if (!sourceMapsBySourceFileName.has(sourceFileName)) {
				sourceMapsBySourceFileName.set(sourceFileName, [
					sourceFileName,
					new SourceMapBase(virtualFile.mappings.filter(mapping => mapping.source === source)),
				]);
			}
		}

		return [...sourceMapsBySourceFileName.values()];
	}

	function getTeleport(file: VirtualFile) {
		const snapshot = virtualFileNameToSource.value.get(normalizePath(file.fileName))![1][1];
		if (!_teleports.has(snapshot)) {
			_teleports.set(snapshot, file.teleportMappings ? new Teleport(file.teleportMappings) : undefined);
		}
		return _teleports.get(snapshot);
	}
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/').toLowerCase();
}
