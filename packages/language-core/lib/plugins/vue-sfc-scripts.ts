import type { EmbeddedCodeInfo, VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, ir) {
			if (vueCompilerOptions.environment !== 'languageservice') {
				return [];
			}
			const result: EmbeddedCodeInfo[] = [];
			if (ir.script) {
				result.push({ id: 'script_raw', lang: ir.script.lang });
			}
			if (ir.scriptSetup) {
				result.push({ id: 'scriptsetup_raw', lang: ir.scriptSetup.lang });
			}
			return result;
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			const script = embeddedFile.id === 'script_raw'
				? ir.script
				: embeddedFile.id === 'scriptsetup_raw'
				? ir.scriptSetup
				: undefined;
			if (script) {
				embeddedFile.content.push([
					script.content,
					script.name,
					0,
					{
						structure: true,
						format: true,
					},
				]);
			}
		},
	};
};

export default plugin;
