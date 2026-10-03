import { Module } from 'module';

/**
 * Patches `Module.prototype._compile` instead of registering a `Module.registerHooks()` load hook:
 * synchronous load hooks are also chained into the ESM loader, where the async loader that the
 * extension host registers for ESM extensions resolves CommonJS dependencies with `source: null`.
 * Node rejects that inside our `nextLoad()` call before we ever see the result, so every ESM
 * extension importing a CommonJS module fails to activate (fixed by nodejs/node#59929, which only
 * landed in Node 22.22.3, 24.11.1 and 25.1.0; VS Code 1.107 still ships Node 22.21.1).
 */
export function registerModuleTransform(fileName: string, transform: (source: string) => string): () => void {
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
