import { URI } from 'vscode-uri';
import * as upath from 'upath';
import type { DocumentUri } from 'vscode-languageserver-textdocument';

export function getPathOfUri(uri: DocumentUri) {
	return URI.parse(uri).path;
}

export function normalizeFileName(fsPath: string) {
	return upath.toUnix(URI.file(fsPath).fsPath);
}

export function normalizeUri(uri: string) {
	return URI.parse(uri).toString();
}

export function getUriByPath(rootUri: URI, path: string) {
	return URI.from({
		scheme: rootUri.scheme,
		authority: rootUri.authority,
		path,
	}).toString();
}
