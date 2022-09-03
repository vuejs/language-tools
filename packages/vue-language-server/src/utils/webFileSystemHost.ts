import * as vscode from 'vscode-languageserver';
import { FileType } from 'vscode-html-languageservice';
import { URI } from 'vscode-uri';
import { FileSystemHost } from '../types';
import { posix as path } from 'path';
import { FsReadDirectoryRequest, FsReadFileRequest, FsStatRequest } from '../requests';
import { matchFiles } from './ts/utilities';
import http from '../schemaRequestHandlers/http';

let currentCwd = '/';

const libBaseUrl = 'https://cdn.jsdelivr.net/npm/typescript@4.8.2/lib/';
const libNames = [
	'lib.d.ts',
	'lib.dom.d.ts',
	'lib.dom.iterable.d.ts',
	'lib.es5.d.ts',
	'lib.es6.d.ts',
	'lib.es2015.collection.d.ts',
	'lib.es2015.core.d.ts',
	'lib.es2015.d.ts',
	'lib.es2015.generator.d.ts',
	'lib.es2015.iterable.d.ts',
	'lib.es2015.promise.d.ts',
	'lib.es2015.proxy.d.ts',
	'lib.es2015.reflect.d.ts',
	'lib.es2015.symbol.d.ts',
	'lib.es2015.symbol.wellknown.d.ts',
	'lib.es2016.array.include.d.ts',
	'lib.es2016.d.ts',
	'lib.es2016.full.d.ts',
	'lib.es2017.d.ts',
	'lib.es2017.full.d.ts',
	'lib.es2017.intl.d.ts',
	'lib.es2017.object.d.ts',
	'lib.es2017.sharedmemory.d.ts',
	'lib.es2017.string.d.ts',
	'lib.es2017.typedarrays.d.ts',
	'lib.es2018.asyncgenerator.d.ts',
	'lib.es2018.asynciterable.d.ts',
	'lib.es2018.d.ts',
	'lib.es2018.full.d.ts',
	'lib.es2018.intl.d.ts',
	'lib.es2018.promise.d.ts',
	'lib.es2018.regexp.d.ts',
	'lib.es2019.array.d.ts',
	'lib.es2019.d.ts',
	'lib.es2019.full.d.ts',
	'lib.es2019.object.d.ts',
	'lib.es2019.string.d.ts',
	'lib.es2019.symbol.d.ts',
	'lib.es2020.bigint.d.ts',
	'lib.es2020.d.ts',
	'lib.es2020.date.d.ts',
	'lib.es2020.full.d.ts',
	'lib.es2020.intl.d.ts',
	'lib.es2020.number.d.ts',
	'lib.es2020.promise.d.ts',
	'lib.es2020.sharedmemory.d.ts',
	'lib.es2020.string.d.ts',
	'lib.es2020.symbol.wellknown.d.ts',
	'lib.es2021.d.ts',
	'lib.es2021.full.d.ts',
	'lib.es2021.intl.d.ts',
	'lib.es2021.promise.d.ts',
	'lib.es2021.string.d.ts',
	'lib.es2021.weakref.d.ts',
	'lib.es2022.array.d.ts',
	'lib.es2022.d.ts',
	'lib.es2022.error.d.ts',
	'lib.es2022.full.d.ts',
	'lib.es2022.intl.d.ts',
	'lib.es2022.object.d.ts',
	'lib.es2022.sharedmemory.d.ts',
	'lib.es2022.string.d.ts',
	'lib.esnext.d.ts',
	'lib.esnext.full.d.ts',
	'lib.esnext.intl.d.ts',
	'lib.esnext.promise.d.ts',
	'lib.esnext.string.d.ts',
	'lib.esnext.weakref.d.ts',
	'lib.scripthost.d.ts',
	'lib.webworker.d.ts',
	'lib.webworker.importscripts.d.ts',
	'lib.webworker.iterable.d.ts',
];

interface Dir {
	dirs: Map<string, Dir>,
	fileTexts: Map<string, string>,
	fileTypes: Map<string, FileType | undefined>,
	searched: boolean,
}

export function createWebFileSystemHost(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	connection: vscode.Connection,
	capabilities: vscode.ClientCapabilities,
): FileSystemHost {

	const onDidChangeWatchedFilesCb = new Set<(params: vscode.DidChangeWatchedFilesParams, reason: 'lsp' | 'web-cache-updated') => void>();
	const root: Dir = {
		dirs: new Map(),
		fileTexts: new Map(),
		fileTypes: new Map(),
		searched: false,
	};
	const pendings = new Set<Promise<void>>();
	const changes: vscode.FileEvent[] = [];
	let checking = false;

	connection.onDidChangeWatchedFiles(params => {
		for (const change of params.changes) {
			const fileName = URI.parse(change.uri).path;
			const dir = getDir(path.dirname(fileName));
			const name = path.basename(fileName);
			if (change.type === vscode.FileChangeType.Created) {
				dir.fileTypes.set(name, FileType.File);
			}
			else if (change.type === vscode.FileChangeType.Changed) {
				dir.fileTexts.delete(name);
			}
			else {
				dir.fileTypes.delete(name);
				dir.fileTexts.delete(name);
			}
		}
		fireChanges(params, 'lsp');
	});

	return {
		init() {
			const dir = getDir('/__DefaultLibFilePath__');
			dir.searched = true;
			return Promise.all(libNames.map(async libName => {
				const text = await http(libBaseUrl + libName);
				dir.fileTexts.set(libName, text);
				dir.fileTypes.set(libName, FileType.File);
			}));
		},
		clearCache() {
			root.dirs.clear();
			root.fileTexts.clear();
			root.fileTypes.clear();
			root.searched = false;
		},
		getWorkspaceFileSystem(rootUri) {

			return {
				newLine: '\n',
				useCaseSensitiveFileNames: false,
				getCurrentDirectory: () => rootUri.path,
				fileExists,
				readFile,
				readDirectory,
				getDirectories,
				resolvePath,
				realpath: path => path, // TODO: cannot implement with vscode
			};

			function resolvePath(fileName: string) {
				if (currentCwd !== rootUri.path) {
					process.chdir(rootUri.path);
					currentCwd = rootUri.path;
				}
				return path.resolve(fileName);
			}

			function fileExists(fileName: string): boolean {
				fileName = resolvePath(fileName);
				const dir = getDir(path.dirname(fileName));
				const name = path.basename(fileName);
				if (dir.fileTypes.has(name)) {
					return dir.fileTypes.get(name) === FileType.File || dir.fileTypes.get(name) === FileType.SymbolicLink;
				}
				dir.fileTypes.set(name, undefined);
				addPending(statAsync(fileName, dir));
				return false;
			}

			function readFile(fileName: string) {
				fileName = resolvePath(fileName);
				const dir = getDir(path.dirname(fileName));
				const name = path.basename(fileName);
				if (dir.fileTexts.has(name)) {
					return dir.fileTexts.get(name);
				}
				dir.fileTexts.set(name, '');
				addPending(readFileAsync(fileName, dir));
				return '';
			}

			function readDirectory(
				dirPath: string,
				extensions?: readonly string[],
				exclude?: readonly string[],
				include?: readonly string[],
				depth?: number,
			) {
				return matchFiles(
					dirPath,
					extensions,
					exclude,
					include,
					false,
					rootUri.path,
					depth,
					dirPath => {

						dirPath = resolvePath(dirPath);
						const dir = getDir(dirPath);
						const files = [...dir.fileTypes];

						if (!dir.searched) {
							dir.searched = true;
							addPending(readDirectoryAsync(dirPath, dir));
						}

						return {
							files: files.filter(file => file[1] === FileType.File).map(file => file[0]),
							directories: files.filter(file => file[1] === FileType.Directory).map(file => file[0]),
						};
					},
					path => path, // TODO
				);
			}

			// for import path completion
			function getDirectories(dirPath: string) {

				dirPath = resolvePath(dirPath);
				const dir = getDir(dirPath);
				const files = [...dir.fileTypes];

				if (!dir.searched) {
					dir.searched = true;
					addPending(readDirectoryAsync(dirPath, dir));
				}

				return files.filter(file => file[1] === FileType.Directory).map(file => file[0]);
			}

			function getFilePathUri(path: string) {
				return URI.from({
					scheme: rootUri.scheme,
					authority: rootUri.authority,
					path: path,
				});
			}

			async function statAsync(fileName: string, dir: Dir) {
				const uri = getFilePathUri(fileName);
				const result = await connection.sendRequest(FsStatRequest.type, uri.toString());
				if (result?.type === FileType.File || result?.type === FileType.SymbolicLink) {
					const name = path.basename(fileName);
					dir.fileTypes.set(name, result.type);
					changes.push({
						uri: uri.toString(),
						type: vscode.FileChangeType.Created,
					});
				}
			}

			async function readFileAsync(fileName: string, dir: Dir) {
				const uri = getFilePathUri(fileName);
				const text = await connection.sendRequest(FsReadFileRequest.type, uri.toString());
				if (text) {
					const name = path.basename(fileName);
					dir.fileTexts.set(name, text);
					changes.push({
						uri: uri.toString(),
						type: vscode.FileChangeType.Changed,
					});
				}
			}

			async function readDirectoryAsync(dirPath: string, dir: Dir) {
				const uri = getFilePathUri(dirPath);
				const result = await connection.sendRequest(FsReadDirectoryRequest.type, uri.toString());
				for (const [name, fileType] of result) {
					if (dir.fileTypes.get(name) !== fileType && (fileType === FileType.File || fileType === FileType.SymbolicLink)) {
						changes.push({
							uri: getFilePathUri(path.join(dirPath, name)).toString(),
							type: vscode.FileChangeType.Created,
						});
					}
					dir.fileTypes.set(name, fileType);
				}
			}
		},
		onDidChangeWatchedFiles: cb => {
			onDidChangeWatchedFilesCb.add(cb);
			return () => onDidChangeWatchedFilesCb.delete(cb);
		},
	};

	async function addPending(p: Promise<any>) {

		pendings.add(p);

		if (checking === false) {
			checking = true;
			while (pendings.size > 0) {
				const _pendings = [...pendings];
				pendings.clear();
				await Promise.all(_pendings);
			}
			if (changes.length) {
				fireChanges({ changes: [...changes] }, 'web-cache-updated');
				changes.length = 0;
			}
			checking = false;
		}
	}

	async function fireChanges(params: vscode.DidChangeWatchedFilesParams, reason: 'lsp' | 'web-cache-updated') {
		for (const cb of [...onDidChangeWatchedFilesCb]) {
			if (onDidChangeWatchedFilesCb.has(cb)) {
				await cb(params, reason);
			}
		}
	}

	function getDir(dirPath: string) {

		const dirNames: string[] = [];

		let currentDirPath = dirPath;
		let currentDirName = path.basename(currentDirPath);

		while (currentDirName !== '') {
			dirNames.push(currentDirName);
			currentDirPath = path.dirname(currentDirPath);
			currentDirName = path.basename(currentDirPath);
		}

		let currentDir = root;

		for (let i = dirNames.length - 1; i >= 0; i--) {
			const nextDirName = dirNames[i];
			currentDir = getDirFromDir(currentDir, nextDirName);
		}

		return currentDir;
	}

	function getDirFromDir(dir: Dir, name: string) {
		let target = dir.dirs.get(name);
		if (!target) {
			target = {
				dirs: new Map(),
				fileTexts: new Map(),
				fileTypes: new Map(),
				searched: false,
			};
			dir.dirs.set(name, target);
		}
		return target;
	}
}
