import { Mapping, Segment, replaceSourceRange } from '@volar/language-core';
import { computed } from 'computeds';
import type * as ts from 'typescript';
import { enableAllFeatures } from '../generators/utils';
import type { Sfc, VueCodeInformation } from '../types';

export function computedMappings(
	snapshot: () => ts.IScriptSnapshot,
	sfc: Sfc
) {
	return computed(() => {
		const str: Segment<VueCodeInformation>[] = [[snapshot().getText(0, snapshot().getLength()), undefined, 0, enableAllFeatures({})]];
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
		return str
			.filter(s => typeof s !== 'string')
			.map<Mapping<VueCodeInformation>>((m) => {
				const text = m[0];
				const start = m[2] as number;
				return {
					sourceOffsets: [start],
					generatedOffsets: [start],
					lengths: [text.length],
					data: m[3] as VueCodeInformation,
				};
			});
	});
}
