import { replaceSourceRange } from 'muggle-string';
import type { VueLanguagePlugin } from '../types';
import { allCodeFeatures } from './shared';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		getEmbeddedCodes() {
			return [{
				id: 'root_tags',
				lang: 'vue-root-tags',
			}];
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id === 'root_tags') {
				embeddedFile.content.push([sfc.content, undefined, 0, allCodeFeatures]);
				for (
					const block of [
						sfc.template,
						sfc.script,
						sfc.scriptSetup,
						...sfc.styles,
						...sfc.customBlocks,
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
						sfc.content.slice(
							block.startTagEnd,
							block.startTagEnd + offset,
						),
						[
							'',
							undefined,
							block.startTagEnd + offset,
							{ structure: true },
						],
						sfc.content.slice(
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
