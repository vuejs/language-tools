import { forEachEmbeddedCode, type VirtualCode } from '@volar/language-core';
import { getScriptAnalysis, getScriptLang, type IR, type VueLanguagePlugin } from '@vue/language-core';
import { type ServiceScript, useServiceScript } from './codegen';

export const serviceScriptRE = /^script_(?:js|jsx|ts|tsx)$/;
export const tsCodegen = new WeakMap<IR, () => ServiceScript>();

const plugin: VueLanguagePlugin = ({
	modules: { typescript: ts },
	vueCompilerOptions,
}) => {
	return {
		version: 4,
		name: 'vue-tsx',

		getEmbeddedCodes(_fileName, ir) {
			const lang = getScriptLang(ir);
			return [{ lang, id: 'script_' + lang }];
		},

		resolveEmbeddedCode(fileName, ir, embeddedFile) {
			if (serviceScriptRE.test(embeddedFile.id)) {
				let getServiceScript = tsCodegen.get(ir);
				if (!getServiceScript) {
					tsCodegen.set(
						ir,
						getServiceScript = useServiceScript(
							ts,
							fileName,
							ir,
							getScriptAnalysis(ts, vueCompilerOptions, fileName, ir),
						),
					);
				}
				embeddedFile.content = [...getServiceScript().codes];
			}
		},
	};
};

export default plugin;

/** The generated TypeScript / JavaScript code of a Vue file, and the extension TypeScript should see it with. */
export function getServiceScript(root: VirtualCode) {
	for (const code of forEachEmbeddedCode(root)) {
		if (serviceScriptRE.test(code.id)) {
			return {
				code,
				extension: '.' + code.id.slice('script_'.length) as '.js' | '.jsx' | '.ts' | '.tsx',
			};
		}
	}
}
