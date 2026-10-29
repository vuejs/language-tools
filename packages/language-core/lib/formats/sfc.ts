import type { IRAttr, VueFormat, VueFormatBlock, VueFormatResult } from '../types';
import { parse } from './parseSfc';

export const sfcParser: VueFormat = {
	parse(_fileName, content) {
		const sfc = parse(content);
		const { template } = sfc;
		for (const error of sfc.errors) {
			// Handle 'Element is missing end tag.' error, see #4893
			if (
				error.code === 24 && template && error.loc
				&& template.start <= error.loc.start.offset && error.loc.start.offset < template.startTagEnd
			) {
				const endTagOffset = template.content.lastIndexOf('<');
				const endTagText = template.content.slice(endTagOffset).trimEnd();
				if ('</template>'.startsWith(endTagText)) {
					template.endTagStart = template.startTagEnd + endTagOffset;
					template.content = template.content.slice(0, endTagOffset);
				}
			}
		}
		return sfc;
	},

	update(sfc, change) {
		const blocks = getBlocks(sfc);
		const hit = blocks.find(([block]) => change.start >= block.startTagEnd && change.end <= block.endTagStart);
		if (!hit) {
			return;
		}
		const [hitBlock, tag] = hit;

		const oldContent = hitBlock.content;
		const newContent = hitBlock.content = oldContent.slice(0, change.start - hitBlock.startTagEnd)
			+ change.newText
			+ oldContent.slice(change.end - hitBlock.startTagEnd);

		// #3449
		const endTagRE = new RegExp(`</\\s*${tag}\\s*>`);
		const insertedEndTag = endTagRE.test(oldContent) !== endTagRE.test(newContent);
		if (insertedEndTag) {
			return;
		}

		const lengthDiff = change.newText.length - (change.end - change.start);
		const shiftStart = (offset: number) => offset > change.end ? offset + lengthDiff : offset;
		const shiftEnd = (offset: number) => offset >= change.end ? offset + lengthDiff : offset;
		const shiftAttr = (attr: IRAttr | undefined) => {
			if (typeof attr === 'object') {
				attr.offset = shiftStart(attr.offset);
			}
		};

		for (const [block] of blocks) {
			block.start = shiftStart(block.start);
			block.startTagEnd = shiftStart(block.startTagEnd);
			block.endTagStart = shiftEnd(block.endTagStart);
			block.end = shiftEnd(block.end);
		}
		shiftAttr(sfc.script?.src);
		shiftAttr(sfc.scriptSetup?.generic);
		for (const style of sfc.styles) {
			shiftAttr(style.src);
			shiftAttr(style.module);
		}

		return sfc;
	},
};

function getBlocks(sfc: VueFormatResult) {
	const blocks: [block: VueFormatBlock, tag: string][] = [];
	if (sfc.template) {
		blocks.push([sfc.template, 'template']);
	}
	if (sfc.script) {
		blocks.push([sfc.script, 'script']);
	}
	if (sfc.scriptSetup) {
		blocks.push([sfc.scriptSetup, 'script']);
	}
	for (const style of sfc.styles) {
		blocks.push([style, 'style']);
	}
	for (const block of sfc.customBlocks) {
		blocks.push([block, block.type]);
	}
	return blocks;
}
