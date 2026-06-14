import { replaceSourceRange } from 'muggle-string';
import type { VueLanguagePlugin } from '../types';
import { allCodeFeatures } from './shared';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 3,

		getEmbeddedCodes() {
			return [{
				id: 'root_tags',
				lang: 'vue-root-tags',
			}];
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id === 'root_tags') {
				embeddedFile.content.push([ir.content, undefined, 0, allCodeFeatures]);
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
						block.innerStart,
						block.innerEnd,
						ir.content.slice(
							block.innerStart,
							block.innerStart + offset,
						),
						[
							'',
							undefined,
							block.innerStart + offset,
							{ structure: true },
						],
						ir.content.slice(
							block.innerStart + offset,
							block.innerEnd,
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
