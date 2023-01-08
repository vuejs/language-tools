import { URI } from 'vscode-uri';
import * as shared from '@volar/shared';

export * as _ from 'vscode-uri';

interface Options<T> {
	delete(key: string): boolean;
	get(key: string): T | undefined;
	has(key: string): boolean;
	set(key: string, value: T): void;
	clear(): void;
	values(): IterableIterator<T>;
}

export function createUriMap<T>(map: Options<T> = new Map<string, T>()) {

	const uriToUri = new Map<string, string>();
	const pathToUri = new Map<string, string>();

	return {
		clear,
		values,
		uriDelete,
		uriGet,
		uriHas,
		uriSet,
		pathDelete,
		pathGet,
		pathHas,
		pathSet,
	};

	function getUriByUri(uri: string) {
		if (!uriToUri.has(uri))
			uriToUri.set(uri, normalizeUri(uri).toLowerCase());
		return uriToUri.get(uri)!;
	}
	function getUriByPath(path: string) {
		if (!pathToUri.has(path)) {
			pathToUri.set(path, shared.fileNameToUri(path).toLowerCase());
		}
		return pathToUri.get(path)!;
	}

	function clear() {
		return map.clear();
	}
	function values() {
		return map.values();
	}

	function uriDelete(_uri: string) {
		return map.delete(getUriByUri(_uri));
	}
	function uriGet(_uri: string) {
		return map.get(getUriByUri(_uri));
	}
	function uriHas(_uri: string) {
		return map.has(getUriByUri(_uri));
	}
	function uriSet(_uri: string, item: T) {
		return map.set(getUriByUri(_uri), item);
	}

	function pathDelete(path: string) {
		return uriDelete(getUriByPath(path));
	}
	function pathGet(path: string) {
		return uriGet(getUriByPath(path));
	}
	function pathHas(path: string) {
		return uriGet(getUriByPath(path));
	}
	function pathSet(path: string, item: T) {
		return uriSet(getUriByPath(path), item);
	}
}

function normalizeUri(uri: string) {
	try {
		return URI.parse(uri).toString();
	} catch {
		return '';
	}
}
