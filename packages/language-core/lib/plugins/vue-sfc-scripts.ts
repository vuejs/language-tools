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
				names.push({ id: 'scriptFormat', lang: sfc.script.lang });
			}
			if (sfc.scriptSetup) {
				names.push({ id: 'scriptSetupFormat', lang: sfc.scriptSetup.lang });
			}
			return names;
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			const script = embeddedFile.id === 'scriptFormat' ? sfc.script
				: embeddedFile.id === 'scriptSetupFormat' ? sfc.scriptSetup
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
