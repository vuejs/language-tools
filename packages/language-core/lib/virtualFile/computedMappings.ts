import type { CodeMapping } from '@volar/language-core';
import { computed } from 'computeds';
import { Segment, replaceSourceRange } from 'muggle-string';
import type * as ts from 'typescript';
import { allCodeFeatures } from '../plugins/shared';
import type { Sfc, VueCodeInformation } from '../types';

export function computedMappings(
	snapshot: () => ts.IScriptSnapshot,
	sfc: Sfc
) {
	return computed(() => {
		const str: Segment<VueCodeInformation>[] = [[snapshot().getText(0, snapshot().getLength()), undefined, 0, allCodeFeatures]];
		for (const block of [
			sfc.script,
			sfc.scriptSetup,
			sfc.template,
			...sfc.styles,
			...sfc.customBlocks,
		]) {
			if (block) {
				replaceSourceRange(str, undefined, block.startTagEnd, block.endTagStart, '\n\n');
			}
		}
		const mappings = str
			.filter(s => typeof s !== 'string')
			.map<CodeMapping>(m => {
				const text = m[0];
				const start = m[2] as number;
				return {
					sourceOffsets: [start],
					generatedOffsets: [start],
					lengths: [text.length],
					data: m[3] as VueCodeInformation,
				};
			});

		// fix folding range end position failed to mapping
		for (const block of [
			sfc.script,
			sfc.scriptSetup,
			sfc.template,
			...sfc.styles,
			...sfc.customBlocks,
		]) {
			const offsets: number[] = [];
			if (block) {
				let content = block.content;
				if (content.endsWith('\r\n')) {
					content = content.slice(0, -2);
				}
				else if (content.endsWith('\n')) {
					content = content.slice(0, -1);
				}
				const offset = content.lastIndexOf('\n') + 1;
				offsets.push(block.startTagEnd + offset);
			}
			if (offsets.length) {
				mappings.push({
					sourceOffsets: offsets,
					generatedOffsets: offsets,
					lengths: offsets.map(() => 0),
					data: { structure: true },
				});
			}
		}

		return mappings;
	});
}
