import { Module } from 'module';
import { pathToFileURL } from 'url';
import { TextDecoder } from 'util';

export function registerModuleTransform(fileName: string, transform: (source: string) => string): () => void {
	if (typeof Module.registerHooks === 'function') {
		const targetUrl = pathToFileURL(fileName).href;
		const hooks = Module.registerHooks({
			load(url, context, nextLoad) {
				const result = nextLoad(url, context);
				if (url === targetUrl && result.source !== undefined) {
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

	// fallback for Node.js versions that do not support Module.registerHooks
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
