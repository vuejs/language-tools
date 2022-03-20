import { URI } from 'vscode-uri';

interface Options<T> {
	delete(key: string): boolean;
	get(key: string): T | undefined;
	has(key: string): boolean;
	set(key: string, value: T): void;
	clear(): void;
	values(): IterableIterator<T>;
}

export function createPathMap<T>(map: Options<T> = new Map<string, T>()) {

	const uriToUriKeys: Record<string, string> = {};
	const fsPathToUriKeys: Record<string, string> = {};

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

function normalizeUri(uri: string) {
	try {
		return URI.parse(uri).toString();
	} catch {
		return '';
	}
}
