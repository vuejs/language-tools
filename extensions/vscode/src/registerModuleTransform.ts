import { Module } from 'module';
import { pathToFileURL } from 'url';
import { TextDecoder } from 'util';

export function registerModuleTransform(fileName: string, transform: (source: string) => string): () => void {
	if (typeof Module.registerHooks === 'function' && hasNullishSourceFix()) {
		const targetUrl = pathToFileURL(fileName).href;
		const hooks = Module.registerHooks({
			load(url, context, nextLoad) {
				const result = nextLoad(url, context);
				if (url === targetUrl && result.source !== undefined && result.source !== null) {
					return {
						...result,
						source: transform(
							typeof result.source === 'string' ? result.source : new TextDecoder().decode(result.source),
						),
					};
				}
				return result;
			},
		});
		return () => hooks.deregister();
	}

	// fallback for Node.js versions where Module.registerHooks is unavailable or unsafe
	const originalCompile = (Module.prototype as any)._compile;
	(Module.prototype as any)._compile = function(this: Module, source: string, filename: string, ...args: any[]) {
		if (filename === fileName) {
			source = transform(source);
		}
		return originalCompile.call(this, source, filename, ...args);
	};
	return () => {
		(Module.prototype as any)._compile = originalCompile;
	};
}

/**
 * Re-evaluates an already loaded module and swaps its exports in place, so that holders of the
 * previous exports object see the transformed implementation. Returns `false` when the exports
 * cannot be written to, which happens with esbuild bundles exposing them as getter-only properties.
 */
export function reloadModuleExports(fileName: string): boolean {
	const loadedModule = require.cache[fileName];
	if (!loadedModule) {
		return true;
	}
	if (!canAssignExports(loadedModule.exports)) {
		return false;
	}
	delete require.cache[fileName];
	Object.assign(loadedModule.exports, require(fileName));
	return true;
}

function canAssignExports(exports: unknown): boolean {
	if (exports === null || (typeof exports !== 'object' && typeof exports !== 'function')) {
		return false;
	}
	// Object.assign copies enumerable own properties only and writes them through [[Set]], which
	// throws on accessors without a setter and on non-writable data properties, regardless of
	// whether they are configurable. Non-enumerable keys such as the `__esModule` marker that tsc
	// emits for CommonJS are never written, so their descriptors do not matter here.
	return Object.isExtensible(exports)
		&& Reflect.ownKeys(exports).every(key => {
			const descriptor = Object.getOwnPropertyDescriptor(exports, key)!;
			return !descriptor.enumerable || descriptor.set !== undefined || descriptor.writable === true;
		});
}

// fix #6244, see nodejs/node#59929 (node 22.22.3+, 24.11.1+, 25.1.0+)
function hasNullishSourceFix() {
	const [major, minor, patch] = process.versions.node.split('.').map(Number) as [number, number, number];
	const fixedIn = ({ 22: [22, 3], 24: [11, 1], 25: [1, 0] } as Record<number, [number, number]>)[major];
	if (!fixedIn) {
		return major > 25;
	}
	return minor > fixedIn[0] || (minor === fixedIn[0] && patch >= fixedIn[1]);
}
