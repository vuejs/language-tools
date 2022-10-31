import { URI } from 'vscode-uri';
import * as path from 'typesafe-path';

export function getPathOfUri(uri: string) {
	return URI.parse(uri).fsPath.replace(/\\/g, '/') as path.PosixPath;
}

export function normalizeFileName(fsPath: string) {
	return URI.file(fsPath).fsPath.replace(/\\/g, '/') as path.PosixPath;
}

export function normalizeUri(uri: string) {
	return URI.parse(uri).toString();
}

export function getUriByPath(rootUri: URI, path: string) {
	return URI.file(path).with({
		scheme: rootUri.scheme,
		authority: rootUri.authority,
	}).toString();
}

export function isFileInDir(fileName: path.OsPath, dir: path.OsPath) {
	const relative = path.relative(dir, fileName);
	return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
