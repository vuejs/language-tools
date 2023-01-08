import { URI } from 'vscode-uri';
import * as path from 'typesafe-path';

export function normalizeFileName(fsPath: string) {
	return uriToFileName(fileNameToUri(fsPath));
}

export function uriToFileName(uri: string) {
	if (uri.startsWith('https://cdn.jsdelivr.net/npm/')) {
		return '/__uri__/node_modules/' + uri.replace('https://cdn.jsdelivr.net/npm/', '') as path.PosixPath;
	}
	const _uri = URI.parse(uri);
	if (_uri.scheme === 'file') {
		return _uri.fsPath.replace(/\\/g, '/') as path.PosixPath;
	}
	else {
		return '/__uri__/' + uri.replace('://', '__uri_scheme__') as path.PosixPath;
	}
}

export function fileNameToUri(path: string) {
	if (path.startsWith('/__uri__/node_modules/')) {
		return path.replace('/__uri__/node_modules/', 'https://cdn.jsdelivr.net/npm/');
	}
	if (path.startsWith('/__uri__/')) {
		return path.replace('/__uri__/', '').replace('__uri_scheme__', '://');
	}
	return URI.file(path).toString();
}

export function syntaxToLanguageId(syntax: string) {
	switch (syntax) {
		case 'js': return 'javascript';
		case 'cjs': return 'javascript';
		case 'mjs': return 'javascript';
		case 'ts': return 'typescript';
		case 'cts': return 'typescript';
		case 'mts': return 'typescript';
		case 'jsx': return 'javascriptreact';
		case 'tsx': return 'typescriptreact';
		case 'pug': return 'jade';
		case 'md': return 'markdown';
	}
	return syntax;
}

export function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
