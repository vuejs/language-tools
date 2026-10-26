import { allFeatures } from '../features';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 4,

		getEmbeddedCodes(_fileName, ir) {
			if (ir.template?.lang === 'html' || ir.template?.lang === 'pug') {
				return [{
					id: 'template',
					lang: ir.template.lang,
				}];
			}
			return [];
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id === 'template' && (ir.template?.lang === 'html' || ir.template?.lang === 'pug')) {
				// Pug reads an indented first line as an error, so an indented template is parsed as the children of a tag
				if (ir.template.lang === 'pug' && calculateMinIndent(ir.template.content) !== 0) {
					embeddedFile.content.push(`template\n`);
				}
				embeddedFile.content.push([
					ir.template.content,
					ir.template.name,
					0,
					{ features: allFeatures },
				]);
			}
		},
	};
};

export default plugin;

function calculateMinIndent(s: string) {
	const lines = s.split('\n');
	const minIndent = lines.reduce(function(minIndent, line) {
		if (line.trim() === '') {
			return minIndent;
		}
		const indent = line.match(/^\s*/)?.[0]?.length || 0;
		return Math.min(indent, minIndent);
	}, Infinity);
	return minIndent;
}
