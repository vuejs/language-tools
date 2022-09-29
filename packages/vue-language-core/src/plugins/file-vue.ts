import { VueLanguagePlugin } from '../types';
import { parse } from '@vue/compiler-sfc';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		parseSFC(fileName, content) {

			if (fileName.endsWith('.vue')) {

				return parse(content, { sourceMap: false, ignoreEmpty: false });
			}
		},

		updateSFC(sfc, change) {

			// avoid broken @vue/compiler-sfc cache
			if (!(sfc as any).__volar_clone) {
				sfc = JSON.parse(JSON.stringify(sfc));
				(sfc as any).__volar_clone = true;
			}

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

			hitBlock.content =
				hitBlock.content.substring(0, change.start - hitBlock.loc.start.offset)
				+ change.newText
				+ hitBlock.content.substring(change.end - hitBlock.loc.start.offset);

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
export = plugin;
