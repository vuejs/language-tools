import type { VueLanguagePlugin } from '../types';
import { parseRawIR } from '../virtualCode/rawIr';

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {
	return {
		version: 3,

		getLanguageId(fileName) {
			if (vueCompilerOptions.extensions.some(ext => fileName.endsWith(ext))) {
				return 'vue';
			}
		},

		isValidFile(_fileName, languageId) {
			return languageId === 'vue';
		},

		parseSFC(_fileName, languageId, content) {
			if (languageId !== 'vue') {
				return;
			}
			return parseRawIR(content);
		},

		updateSFC(result, change) {
			const blocks = [
				...result.rawIr.templates,
				...result.rawIr.scripts,
				...result.rawIr.styles,
				...result.rawIr.customBlocks,
			];

			const hitBlock = blocks.find(block => change.start >= block.innerStart && change.end <= block.innerEnd);
			if (!hitBlock) {
				return;
			}

			const oldContent = hitBlock.content;
			const newContent = hitBlock.content = hitBlock.content.slice(0, change.start - hitBlock.innerStart)
				+ change.newText
				+ hitBlock.content.slice(change.end - hitBlock.innerStart);

			// #3449
			const endTagRegex = new RegExp(`</\\s*${hitBlock.name}\\s*>`);
			const insertedEndTag = endTagRegex.test(oldContent) !== endTagRegex.test(newContent);
			if (insertedEndTag) {
				return;
			}

			const lengthDiff = change.newText.length - (change.end - change.start);
			hitBlock.innerEnd += lengthDiff;
			hitBlock.end += lengthDiff;

			for (const block of blocks) {
				if (block === hitBlock) {
					continue;
				}
				for (const key of ['start', 'end', 'innerStart', 'innerEnd'] as const) {
					if (block[key] >= change.end) {
						block[key] += lengthDiff;
					}
				}
			}

			return result;
		},
	};
};

export default plugin;
