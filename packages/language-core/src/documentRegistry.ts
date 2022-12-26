import { SourceMap } from '@volar/source-map';
import { MirrorMap } from './sourceMaps';
import type { LanguageModule, FileRangeCapabilities, VirtualFile } from './types';

export type VirtualFiles = ReturnType<typeof createVirtualFiles>;

type Source = [
	string, // source file name
	ts.IScriptSnapshot, // source file snapshot
	VirtualFile, // root virtual file
	LanguageModule, // language module that created the root virtual file
];

export function createVirtualFiles(languageModules: LanguageModule[]) {

	const sourceFiles = new Map<string, Source>();
	const virtualFiles = new Map<string, [VirtualFile, Source]>();
	const virtualFileToSourceMapsMap = new WeakMap<ts.IScriptSnapshot, Map<string, [string, SourceMap<FileRangeCapabilities>]>>();
	const virtualFileToMirrorMap = new WeakMap<ts.IScriptSnapshot, MirrorMap | undefined>();

	let sourceFilesDirty = true;

	return {
		all: sourceFiles,
		update(fileName: string, snapshot: ts.IScriptSnapshot) {
			const key = normalizePath(fileName);
			const value = sourceFiles.get(key);
			if (value) {
				const virtualFile = value[2];
				value[1] = snapshot;
				value[3].updateFile(virtualFile, snapshot);
				sourceFilesDirty = true;
				return virtualFile; // updated
			}
			for (const languageModule of languageModules) {
				const virtualFile = languageModule.createFile(fileName, snapshot);
				if (virtualFile) {
					sourceFiles.set(key, [fileName, snapshot, virtualFile, languageModule]);
					sourceFilesDirty = true;
					return virtualFile; // created
				}
			}
		},
		delete(fileName: string) {
			const key = normalizePath(fileName);
			const value = sourceFiles.get(key);
			if (value) {
				const virtualFile = value[2];
				value[3].deleteFile?.(virtualFile);
				sourceFiles.delete(key); // deleted
				sourceFilesDirty = true;
			}
		},
		get(fileName: string) {
			const key = normalizePath(fileName);
			const value = sourceFiles.get(key);
			if (value) {
				return [
					value[1],
					value[2],
				] as const;
			}
		},
		hasSourceFile: (fileName: string) => sourceFiles.has(normalizePath(fileName)),
		getMirrorMap: getMirrorMap,
		getMaps: getSourceMaps,
		getSourceByVirtualFileName(fileName: string) {
			const source = getVirtualFilesMap().get(normalizePath(fileName));
			if (source) {
				return [
					source[1][0],
					source[1][1],
					source[0],
				] as const;
			}
		},
	};

	function getVirtualFilesMap() {
		if (sourceFilesDirty) {
			sourceFilesDirty = false;
			virtualFiles.clear();
			for (const [_, row] of sourceFiles) {
				forEachEmbeddedFile(row[2], file => {
					virtualFiles.set(normalizePath(file.fileName), [file, row]);
				});
			}
		}
		return virtualFiles;
	}

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
			const sourceFileName = source ?? getVirtualFilesMap().get(normalizePath(virtualFile.fileName))![1][0];
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
