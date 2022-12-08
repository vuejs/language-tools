import { URI } from 'vscode-uri';
import * as path from 'typesafe-path';

export function getPathOfUri(uri: string) {
	const _uri = URI.parse(uri);
	if (_uri.scheme === 'file') {
		return _uri.fsPath.replace(/\\/g, '/') as path.PosixPath;
	}
	else {
		return '/__uri__/' + uri.replace('://', '__uriScheme__/') as path.PosixPath;
	}
}

export function normalizeFileName(fsPath: string) {
	return URI.file(fsPath).fsPath.replace(/\\/g, '/') as path.PosixPath;
}

export function getUriByPath(path: string) {
	if (path.startsWith('/__uri__/')) {
		return path.replace('/__uri__/', '').replace('__uriScheme__/', '://');
	}
	return URI.file(path).toString();
}

export function isFileInDir(fileName: path.OsPath, dir: path.OsPath) {
	const relative = path.relative(dir, fileName);
	return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
