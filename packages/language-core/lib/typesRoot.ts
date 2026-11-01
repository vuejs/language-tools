import { posix as path } from 'path-browserify';

/**
 * The `types` directory of this package. The module must stay one level below the package root: in the VS Code
 * extension's bundle `__dirname` is `dist/`, beside which the extension copies `types/`.
 */
export function getDefaultTypesRoot() {
	return typeof __dirname !== 'undefined'
		? path.join(__dirname.replace(/\\/g, '/'), '..', 'types')
		: '@vue/language-core/types';
}
