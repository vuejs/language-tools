import { VueLanguagePlugin } from '../sourceFile';
import * as CompilerDom from '@vue/compiler-dom';
import * as CompilerVue2 from '../utils/vue2TemplateCompiler';

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {

	return {

		compileSFCTemplate(lang, template, options) {

			if (lang === 'html') {

				const compiler = vueCompilerOptions.target < 3 ? CompilerVue2 : CompilerDom;

				return compiler.compile(template, options);
			}
		},
	};
};
export = plugin;
