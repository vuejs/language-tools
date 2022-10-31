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

	const uriToUriKeys: Map<string, string> = new Map();
	const pathToUriKeys: WeakMap<URI, Map<string, string>> = new WeakMap();

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
		if (!uriToUriKeys.has(uri))
			uriToUriKeys.set(uri, normalizeUri(uri).toLowerCase());
		return uriToUriKeys.get(uri)!;
	}
	function getUriByPath(rootUri: URI, path: string) {
		let map = pathToUriKeys.get(rootUri);
		if (!map) {
			map = new Map();
			pathToUriKeys.set(rootUri, map);
		}
		if (!map.has(path)) {
			map.set(path, shared.getUriByPath(rootUri, path).toLowerCase());
		}
		return map.get(path)!;
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

	function pathDelete(rootUri: URI, path: string) {
		return uriDelete(getUriByPath(rootUri, path));
	}
	function pathGet(rootUri: URI, path: string) {
		return uriGet(getUriByPath(rootUri, path));
	}
	function pathHas(rootUri: URI, path: string) {
		return uriGet(getUriByPath(rootUri, path));
	}
	function pathSet(rootUri: URI, path: string, item: T) {
		return uriSet(getUriByPath(rootUri, path), item);
	}
}

function normalizeUri(uri: string) {
	try {
		return URI.parse(uri).toString();
	} catch {
		return '';
	}
}
