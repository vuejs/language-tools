import { URI } from 'vscode-uri';
import * as upath from 'upath';
import type { DocumentUri } from 'vscode-languageserver-textdocument';

export function uriToFsPath(uri: DocumentUri) {
	return upath.toUnix(URI.parse(uri).fsPath);
}

export function fsPathToUri(fsPath: string): DocumentUri {
	return URI.file(fsPath).toString();
}

export function normalizeFileName(fileName: string) {
	return uriToFsPath(fsPathToUri(fileName));
}

export function isFileInDir(fileName: string, dir: string) {
	const relative = upath.relative(dir, fileName);
	return relative && !relative.startsWith('..') && !upath.isAbsolute(relative);
}
