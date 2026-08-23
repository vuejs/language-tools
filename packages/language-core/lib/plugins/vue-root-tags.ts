import { replaceSourceRange } from 'muggle-string';
import { codeFeatures } from '../codegen/codeFeatures';
import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		getEmbeddedCodes() {
			return [{
				id: 'root_tags',
				lang: 'vue-root-tags',
			}];
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id === 'root_tags') {
				embeddedFile.content.push([ir.content, undefined, 0, codeFeatures.full]);
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
							codeFeatures.structure,
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
