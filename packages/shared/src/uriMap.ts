import { URI } from 'vscode-uri';
import { fsPathToUri } from './path';

interface Options<T> {
	delete(key: string): boolean;
	get(key: string): T | undefined;
	has(key: string): boolean;
	set(key: string, value: T): void;
	clear(): void;
}

export function createPathMap<T>(map: Options<T> = new Map<string, T>()) {

	return {
		clear,
		uriDelete,
		uriGet,
		uriHas,
		uriSet,
		fsPathDelete,
		fsPathGet,
		fsPathHas,
		fsPathSet,
	};

	function clear() {
		return map.clear();
	}

	function uriDelete(_uri: string) {
		return map.delete(normalizeUri(_uri).toLowerCase());
	}
	function uriGet(_uri: string) {
		return map.get(normalizeUri(_uri).toLowerCase());
	}
	function uriHas(_uri: string) {
		return map.has(normalizeUri(_uri).toLowerCase());
	}
	function uriSet(_uri: string, item: T) {
		return map.set(normalizeUri(_uri).toLowerCase(), item);
	}

	function fsPathDelete(_fsPath: string) {
		return map.delete(fsPathToUri(_fsPath).toLowerCase());
	}
	function fsPathGet(_fsPath: string) {
		return map.get(fsPathToUri(_fsPath).toLowerCase());
	}
	function fsPathHas(_fsPath: string) {
		return map.has(fsPathToUri(_fsPath).toLowerCase());
	}
	function fsPathSet(_fsPath: string, item: T) {
		return map.set(fsPathToUri(_fsPath).toLowerCase(), item);
	}
}

function normalizeUri(uri: string) {
	try {
		return URI.parse(uri).toString();
	} catch {
		return '';
	}
}
