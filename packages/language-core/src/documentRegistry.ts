import { SourceMap } from '@volar/source-map';
import { computed, shallowReactive as reactive } from '@vue/reactivity';
import { MirrorMap } from './sourceMaps';
import type { LanguageModule, FileRangeCapabilities, VirtualFile } from './types';

export type VirtualFiles = ReturnType<typeof createVirtualFiles>;

type Row = [
	string, // source file name
	ts.IScriptSnapshot, // source file snapshot
	VirtualFile, // root virtual file
	LanguageModule, // language module that created the root virtual file
];

export function createVirtualFiles(languageModules: LanguageModule[]) {

	const sourceFileToRootVirtualFileMap = reactive<Record<string, Row>>({});
	const all = computed(() => Object.values(sourceFileToRootVirtualFileMap));
	const virtualFileNameToSource = computed(() => {
		const map = new Map<string, [VirtualFile, Row]>();
		for (const row of all.value) {
			forEachEmbeddedFile(row[2], file => {
				map.set(normalizePath(file.fileName), [file, row]);
			});
		}
		return map;
	});
	const virtualFileToSourceMapsMap = new WeakMap<ts.IScriptSnapshot, Map<string, [string, SourceMap<FileRangeCapabilities>]>>();
	const virtualFileToMirrorMap = new WeakMap<ts.IScriptSnapshot, MirrorMap | undefined>();

	return {
		update(fileName: string, snapshot: ts.IScriptSnapshot) {
			const key = normalizePath(fileName);
			if (sourceFileToRootVirtualFileMap[key]) {
				const virtualFile = sourceFileToRootVirtualFileMap[key][2];
				sourceFileToRootVirtualFileMap[key][1] = snapshot;
				sourceFileToRootVirtualFileMap[key][3].updateFile(virtualFile, snapshot);
				return virtualFile; // updated
			}
			for (const languageModule of languageModules) {
				const virtualFile = languageModule.createFile(fileName, snapshot);
				if (virtualFile) {
					sourceFileToRootVirtualFileMap[key] = [fileName, snapshot, reactive(virtualFile), languageModule];
					return virtualFile; // created
				}
			}
		},
		delete(fileName: string) {
			const key = normalizePath(fileName);
			if (sourceFileToRootVirtualFileMap[key]) {
				const virtualFile = sourceFileToRootVirtualFileMap[key][2];
				sourceFileToRootVirtualFileMap[key][3].deleteFile?.(virtualFile);
				delete sourceFileToRootVirtualFileMap[key]; // deleted
			}
		},
		get(fileName: string) {
			const key = normalizePath(fileName);
			if (sourceFileToRootVirtualFileMap[key]) {
				return [
					sourceFileToRootVirtualFileMap[key][1],
					sourceFileToRootVirtualFileMap[key][2],
				] as const;
			}
		},
		hasSourceFile: (fileName: string) => !!sourceFileToRootVirtualFileMap[normalizePath(fileName)],
		all: () => all.value,
		getMirrorMap: getMirrorMap,
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
		let sourceMapsBySourceFileName = virtualFileToSourceMapsMap.get(virtualFile.snapshot);
		if (!sourceMapsBySourceFileName) {
			sourceMapsBySourceFileName = new Map();
			virtualFileToSourceMapsMap.set(virtualFile.snapshot, sourceMapsBySourceFileName);
		}

		const sources = new Set<string | undefined>();
		for (const map of virtualFile.mappings) {
			sources.add(map.source);
		}

		for (const source of sources) {
			const sourceFileName = source ?? virtualFileNameToSource.value.get(normalizePath(virtualFile.fileName))![1][0];
			if (!sourceMapsBySourceFileName.has(sourceFileName)) {
				sourceMapsBySourceFileName.set(sourceFileName, [
					sourceFileName,
					new SourceMap(virtualFile.mappings.filter(mapping => mapping.source === source)),
				]);
			}
		}

		return [...sourceMapsBySourceFileName.values()];
	}

	function getMirrorMap(file: VirtualFile) {
		if (!virtualFileToMirrorMap.has(file.snapshot)) {
			virtualFileToMirrorMap.set(file.snapshot, file.mirrorBehaviorMappings ? new MirrorMap(file.mirrorBehaviorMappings) : undefined);
		}
		return virtualFileToMirrorMap.get(file.snapshot);
	}
}

export function forEachEmbeddedFile(file: VirtualFile, cb: (embedded: VirtualFile) => void) {
	cb(file);
	for (const embeddedFile of file.embeddedFiles) {
		forEachEmbeddedFile(embeddedFile, cb);
	}
}

function normalizePath(fileName: string) {
	return fileName.replace(/\\/g, '/').toLowerCase();
}
