import { replaceSourceRange } from 'muggle-string';
import { allFeatures, structureFeatures } from '../features';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 4,

		getEmbeddedCodes() {
			return [{
				id: 'root_tags',
				lang: 'vue-root-tags',
			}];
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id === 'root_tags') {
				embeddedFile.content.push([ir.content, undefined, 0, { features: allFeatures }]);
				for (
					const block of [
						ir.template,
						ir.script,
						ir.scriptSetup,
						...ir.styles,
						...ir.customBlocks,
					]
				) {
					if (!block) {
						continue;
					}
					const offset = block.content.lastIndexOf('\n', block.content.lastIndexOf('\n') - 1) + 1;
					// fix folding range end position failed to mapping
					replaceSourceRange(
						embeddedFile.content,
						undefined,
						block.startTagEnd,
						block.endTagStart,
						ir.content.slice(
							block.startTagEnd,
							block.startTagEnd + offset,
						),
						[
							'',
							undefined,
							block.startTagEnd + offset,
							{ features: structureFeatures },
						],
						ir.content.slice(
							block.startTagEnd + offset,
							block.endTagStart,
						),
					);
				}
			}
			else {
				embeddedFile.parentCodeId ??= 'root_tags';
			}
		},
	};
};

export default plugin;
