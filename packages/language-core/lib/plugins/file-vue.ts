import type { VueLanguagePlugin } from '../types';
import { parse } from '../utils/parseSfc';

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {

	return {

		version: 2.1,

		getLanguageId(fileName) {
			if (vueCompilerOptions.extensions.some(ext => fileName.endsWith(ext))) {
				return 'vue';
			}
		},

		isValidFile(_fileName, languageId) {
			return languageId === 'vue';
		},

		parseSFC2(_fileName, languageId, content) {
			if (languageId !== 'vue') {
				return;
			}
			return parse(content);
		},

		updateSFC(sfc, change) {

			const blocks = [
				sfc.descriptor.template,
				sfc.descriptor.script,
				sfc.descriptor.scriptSetup,
				...sfc.descriptor.styles,
				...sfc.descriptor.customBlocks,
			].filter(block => !!block);

			const hitBlock = blocks.find(block => change.start >= block.loc.start.offset && change.end <= block.loc.end.offset);
			if (!hitBlock) {
				return;
			}

			const oldContent = hitBlock.content;
			const newContent = hitBlock.content =
				hitBlock.content.slice(0, change.start - hitBlock.loc.start.offset)
				+ change.newText
				+ hitBlock.content.slice(change.end - hitBlock.loc.start.offset);

			// #3449
			const endTagRegex = new RegExp(`</\\s*${hitBlock.type}\\s*>`);
			const insertedEndTag = endTagRegex.test(oldContent) !== endTagRegex.test(newContent);
			if (insertedEndTag) {
				return;
			}

			const lengthDiff = change.newText.length - (change.end - change.start);

			for (const block of blocks) {
				if (block.loc.start.offset > change.end) {
					block.loc.start.offset += lengthDiff;
				}
				if (block.loc.end.offset >= change.end) {
					block.loc.end.offset += lengthDiff;
				}
			}

			return sfc;
		},
	};
};

export default plugin;
