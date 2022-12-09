import { URI } from 'vscode-uri';
import * as path from 'typesafe-path';

export function getPathOfUri(uri: string) {
	const _uri = URI.parse(uri);
	if (_uri.scheme === 'file') {
		return _uri.fsPath.replace(/\\/g, '/') as path.PosixPath;
	}
	else {
		return '/__uri__' + uri.replace('://', '__uri_scheme__/') as path.PosixPath;
	}
}

export function normalizeFileName(fsPath: string) {
	return getPathOfUri(getUriByPath(fsPath));
}

export function getUriByPath(path: string) {
	if (path.startsWith('/__uri__')) {
		return path.replace('/__uri__', '').replace('__uri_scheme__/', '://');
	}
	return URI.file(path).toString();
}

export function isFileInDir(fileName: path.OsPath | path.PosixPath, dir: path.OsPath | path.PosixPath) {
	const relative = path.relative(dir, fileName);
	return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
