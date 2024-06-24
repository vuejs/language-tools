import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 2,

		getEmbeddedCodes(_fileName, sfc) {
			const names: {
				id: string;
				lang: string;
			}[] = [];
			if (sfc.script) {
				names.push({ id: 'script_raw', lang: sfc.script.lang });
			}
			if (sfc.scriptSetup) {
				names.push({ id: 'scriptsetup_raw', lang: sfc.scriptSetup.lang });
			}
			return names;
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			const script = embeddedFile.id === 'script_raw' ? sfc.script
				: embeddedFile.id === 'scriptsetup_raw' ? sfc.scriptSetup
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
