import { URI } from 'vscode-uri';
import * as upath from 'upath';

export function normalizeFileName(fsPath: string) {
	return upath.toUnix(URI.file(fsPath).fsPath);
}

export function normalizeUri(uri: string) {
	return URI.parse(uri).toString();
}

export function isFileInDir(fileName: string, dir: string) {
	const relative = upath.relative(dir, fileName);
	return relative && !relative.startsWith('..') && !upath.isAbsolute(relative);
}
