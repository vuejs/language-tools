import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = ({ modules }) => {

	return {

		version: 2.1,

		compileSFCScript(lang, script) {
			if (lang === 'js' || lang === 'ts' || lang === 'jsx' || lang === 'tsx') {
				const ts = modules.typescript;
				return ts.createSourceFile('test.' + lang, script, 99 satisfies typeof ts.ScriptTarget.Latest);
			}
		},
	};
};

export default plugin;
