// Injected into the tsserver process via `--require` (see patchTypeScriptExtension in extension.ts)
const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');

try {
	const entry = process.argv[1];
	if (entry && path.basename(entry) === 'tsserver.js') {
		const resolvedEntry = fs.realpathSync(entry);
		const typescriptPath = path.join(path.dirname(resolvedEntry), 'typescript.js');
		const readFileSync = fs.readFileSync;
		(fs as any).readFileSync = (...args: any[]) => {
			if (args[0] === typescriptPath) {
				let content: any = readFileSync(...args as [any]);
				content = content.replace(
					/supportedTSExtensions = .*(?=;)/,
					(s: string) => s + `.concat([".vue"])`,
				);
				content = content.replace(
					/supportedJSExtensions = .*(?=;)/,
					(s: string) => s + `.concat([".vue"])`,
				);
				content = content.replace(
					/allSupportedExtensions = .*(?=;)/,
					(s: string) => s + `.concat([".vue"])`,
				);
				content = content.replace(
					/function changeExtension\(/,
					(s: string) =>
						`function changeExtension(path, newExtension) {
						return [".vue"].some(ext => path.endsWith(ext))
						? path + newExtension
						: _changeExtension(path, newExtension);
					}\n` + s.replace('changeExtension', '_changeExtension'),
				);
				content = content.replace(
					/const isJs = hasJSFileExtension\((.*?)\.fileName\)/,
					(_s: string, file: string) => `const isJs = isSourceFileJS(${file})`,
				);
				return content;
			}
			return readFileSync(...args as [any]);
		};
	}
}
catch (error) {
	console.warn('[Vue] Failed to patch tsserver:', error);
}
