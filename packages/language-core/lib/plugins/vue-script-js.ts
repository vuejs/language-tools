import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = ({ modules }) => {
	return {
		version: 4,

		compileSFCScript(lang, script) {
			if (lang === 'js' || lang === 'ts' || lang === 'jsx' || lang === 'tsx') {
				const ts = modules.typescript;
				return ts.createSourceFile('.' + lang, script, 99 satisfies ts.ScriptTarget.Latest);
			}
		},
	};
};

export default plugin;
