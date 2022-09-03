import * as vscode from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { FileSystemHost } from '../types';
import { IterableWeakSet } from './iterableWeakSet';

let currentCwd = '';

export function createNodeFileSystemHost(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	connection: vscode.Connection,
	capabilities: vscode.ClientCapabilities,
): FileSystemHost {

	const onDidChangeWatchedFilesCb = new Set<(params: vscode.DidChangeWatchedFilesParams, reason: 'lsp' | 'web-cache-updated') => void>();
	const caches = new IterableWeakSet<Map<string, boolean>>();

	connection.onDidChangeWatchedFiles(async params => {
		if (params.changes.some(change => change.type === vscode.FileChangeType.Created || change.type === vscode.FileChangeType.Deleted)) {
			caches.forEach(cache => {
				cache.clear();
			});
		}
		for (const cb of [...onDidChangeWatchedFilesCb]) {
			if (onDidChangeWatchedFilesCb.has(cb)) {
				await cb(params, 'lsp');
			}
		}
	});

	return {
		clearCache() {
			caches.forEach(cache => {
				cache.clear();
			});
		},
		getWorkspaceFileSystem(rootUri: URI) {

			const workspaceSys = new Proxy(ts.sys, {
				get(target, prop) {
					const fn = target[prop as keyof typeof target];
					if (typeof fn === 'function') {
						return new Proxy(fn, {
							apply(target, thisArg, args) {
								if (currentCwd !== rootUri.fsPath) {
									process.chdir(rootUri.fsPath);
									currentCwd = rootUri.fsPath;
								}
								return (target as any).apply(thisArg, args);
							}
						});
					}
					return fn;
				},
			});
			const fileExistsCache = new Map<string, boolean>();
			const directoryExistsCache = new Map<string, boolean>();
			const sysWithCache: Partial<typeof ts.sys> = {
				fileExists(path: string) {
					if (!fileExistsCache.has(path)) {
						fileExistsCache.set(path, ts.sys.fileExists(path));
					}
					return fileExistsCache.get(path)!;
				},
				directoryExists(path: string) {
					if (!directoryExistsCache.has(path)) {
						directoryExistsCache.set(path, ts.sys.directoryExists(path));
					}
					return directoryExistsCache.get(path)!;
				},
			};
			// don't cache fs result if client did not supports file watcher
			const sys = capabilities.workspace?.didChangeWatchedFiles
				? new Proxy(workspaceSys, {
					get(target, prop) {
						if (prop in sysWithCache) {
							return sysWithCache[prop as keyof typeof sysWithCache];
						}
						return target[prop as keyof typeof target];
					},
				})
				: workspaceSys;

			caches.add(fileExistsCache);
			caches.add(directoryExistsCache);

			return sys;
		},
		onDidChangeWatchedFiles: cb => {
			onDidChangeWatchedFilesCb.add(cb);
			return () => onDidChangeWatchedFilesCb.delete(cb);
		},
	};
}
