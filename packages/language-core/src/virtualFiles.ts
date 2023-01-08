import { SourceMap } from '@volar/source-map';
import { MirrorMap } from './sourceMaps';
import type { LanguageModule, FileRangeCapabilities, VirtualFile } from './types';

export type VirtualFiles = ReturnType<typeof createVirtualFiles>;

export interface Source {
	fileName: string;
	snapshot: ts.IScriptSnapshot;
	root: VirtualFile;
	languageModule: LanguageModule;
}

export function createVirtualFiles(languageModules: LanguageModule[]) {

	const sourceFiles = new Map<string, Source>();
	const virtualFiles = new Map<string, { virtualFile: VirtualFile, source: Source; }>();
	const virtualFileToSourceMapsMap = new WeakMap<ts.IScriptSnapshot, Map<string, [string, SourceMap<FileRangeCapabilities>]>>();
	const virtualFileToMirrorMap = new WeakMap<ts.IScriptSnapshot, MirrorMap | undefined>();

	let sourceFilesDirty = true;

	return {
		allSources() {
			return Array.from(sourceFiles.values());
		},
		updateSource(fileName: string, snapshot: ts.IScriptSnapshot) {
			const key = normalizePath(fileName);
			const value = sourceFiles.get(key);
			if (value) {
				value.snapshot = snapshot;
				value.languageModule.updateFile(value.root, snapshot);
				sourceFilesDirty = true;
				return value.root; // updated
			}
			for (const languageModule of languageModules) {
				const virtualFile = languageModule.createFile(fileName, snapshot);
				if (virtualFile) {
					sourceFiles.set(key, { fileName, snapshot, root: virtualFile, languageModule });
					sourceFilesDirty = true;
					return virtualFile; // created
				}
			}
		},
		deleteSource(fileName: string) {
			const key = normalizePath(fileName);
			const value = sourceFiles.get(key);
			if (value) {
				value.languageModule.deleteFile?.(value.root);
				sourceFiles.delete(key); // deleted
				sourceFilesDirty = true;
			}
		},
		getSource(fileName: string) {
			const key = normalizePath(fileName);
			return sourceFiles.get(key);
		},
		hasSource: (fileName: string) => sourceFiles.has(normalizePath(fileName)),
		getMirrorMap: getMirrorMap,
		getMaps: getSourceMaps,
		hasVirtualFile(fileName: string) {
			return !!getVirtualFilesMap().get(normalizePath(fileName));
		},
		getVirtualFile(fileName: string) {
			const sourceAndVirtual = getVirtualFilesMap().get(normalizePath(fileName));
			if (sourceAndVirtual) {
				return [sourceAndVirtual.virtualFile, sourceAndVirtual.source] as const;
			}
			return [undefined, undefined] as const;
		},
	};

	function getVirtualFilesMap() {
		if (sourceFilesDirty) {
			sourceFilesDirty = false;
			virtualFiles.clear();
			for (const [_, row] of sourceFiles) {
				forEachEmbeddedFile(row.root, file => {
					virtualFiles.set(normalizePath(file.fileName), { virtualFile: file, source: row });
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
			const sourceFileName = source ?? getVirtualFilesMap().get(normalizePath(virtualFile.fileName))!.source.fileName;
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
