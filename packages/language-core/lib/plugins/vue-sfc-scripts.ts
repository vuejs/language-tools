import { SpanMapFeature } from '@volar/language-core';
import { completionFeatures, structureFeatures } from '../features';
import type { EmbeddedCodePlugin } from '../virtualCode/embeddedCodes';

/**
 * Each script block verbatim, for the TypeScript syntactic features of the block (structure, formatting, JSDoc
 * comment templates, JSX closing tags), whichever content mapper serves the file to TypeScript.
 */
const plugin: EmbeddedCodePlugin = () => {
	return {
		version: 4,

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
					{ features: structureFeatures | SpanMapFeature.Formatting | completionFeatures },
				]);
			}
		},
	};
};

export default plugin;
