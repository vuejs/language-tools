import { URI } from 'vscode-uri';
import { getUriByPath as _getUriByPath } from './path';

interface Options<T> {
	delete(key: string): boolean;
	get(key: string): T | undefined;
	has(key: string): boolean;
	set(key: string, value: T): void;
	clear(): void;
	values(): IterableIterator<T>;
}

export function createUriMap<T>(map: Options<T> = new Map<string, T>()) {

	const uriToUriKeys: Record<string, string> = {};

	return {
		clear,
		values,
		uriDelete,
		uriGet,
		uriHas,
		uriSet,
	};

	function getUriByUri(uri: string) {
		if (uriToUriKeys[uri] === undefined)
			uriToUriKeys[uri] = normalizeUri(uri).toLowerCase();
		return uriToUriKeys[uri];
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
}

export function createUriAndPathMap<T>(rootUri: URI, map: Options<T> = new Map<string, T>()) {

	const base = createUriMap(map);
	const pathToUriKeys: Record<string, string> = {};

	return {
		...base,
		pathDelete,
		pathGet,
		pathHas,
		pathSet,
	};

	function getUriByPath(path: string) {
		if (pathToUriKeys[path] === undefined)
			pathToUriKeys[path] = _getUriByPath(rootUri, path).toLowerCase();
		return pathToUriKeys[path];
	}

	function pathDelete(path: string) {
		return map.delete(getUriByPath(path));
	}
	function pathGet(path: string) {
		return map.get(getUriByPath(path));
	}
	function pathHas(path: string) {
		return map.has(getUriByPath(path));
	}
	function pathSet(path: string, item: T) {
		return map.set(getUriByPath(path), item);
	}
}

function normalizeUri(uri: string) {
	try {
		return URI.parse(uri).toString();
	} catch {
		return '';
	}
}
