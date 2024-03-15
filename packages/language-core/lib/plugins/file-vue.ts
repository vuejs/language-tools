import type { VueLanguagePlugin } from '../types';
import { parse } from '../utils/parseSfc';

const plugin: VueLanguagePlugin = _ctx => {

	return {

		version: 2,

		parseSFC(_fileName, content) {
			return parse(content);
		},

		updateSFC(sfc, change) {

			const blocks = [
				sfc.descriptor.template,
				sfc.descriptor.script,
				sfc.descriptor.scriptSetup,
				...sfc.descriptor.styles,
				...sfc.descriptor.customBlocks,
			].filter((block): block is NonNullable<typeof block> => !!block);

			const hitBlock = blocks.find(block => change.start >= block.loc.start.offset && change.end <= block.loc.end.offset);
			if (!hitBlock) {
				return;
			}

			const oldContent = hitBlock.content;
			const newContent = hitBlock.content =
				hitBlock.content.substring(0, change.start - hitBlock.loc.start.offset)
				+ change.newText
				+ hitBlock.content.substring(change.end - hitBlock.loc.start.offset);

			// #3449
			const endTagRegex = new RegExp(`</\\s*${hitBlock.type}\\s*>`);
			const insertedEndTag = !!oldContent.match(endTagRegex) !== !!newContent.match(endTagRegex);
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
