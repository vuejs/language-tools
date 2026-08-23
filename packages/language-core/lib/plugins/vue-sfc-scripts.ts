import { codeFeatures } from '../codegen/codeFeatures';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, ir) {
			const names: {
				id: string;
				lang: string;
			}[] = [];
			if (ir.script) {
				names.push({ id: 'script_raw', lang: ir.script.lang });
			}
			if (ir.scriptSetup) {
				names.push({ id: 'scriptsetup_raw', lang: ir.scriptSetup.lang });
			}
			return names;
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
					codeFeatures.structureAndFormat,
				]);
			}
		},
	};
};

export default plugin;
