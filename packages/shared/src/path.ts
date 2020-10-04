import { URI } from 'vscode-uri';
import * as upath from 'upath';

export function uriToFsPath(uri: string) {
	return upath.toUnix(URI.parse(uri).fsPath);
}
export function fsPathToUri(fsPath: string) {
	return URI.file(fsPath).toString();
}
