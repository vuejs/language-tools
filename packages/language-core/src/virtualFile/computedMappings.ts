import { Mapping, Segment } from '@volar/source-map';
import * as muggle from 'muggle-string';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { Sfc, VueCodeInformation } from '../types';
import { computed } from 'computeds';

export function computedMappings(
	snapshot: () => ts.IScriptSnapshot,
	sfc: Sfc
) {
	return computed(() => {
		const str: Segment<VueCodeInformation>[] = [[snapshot().getText(0, snapshot().getLength()), undefined, 0, {}]];
		for (const block of [
			sfc.script,
			sfc.scriptSetup,
			sfc.template,
			...sfc.styles,
			...sfc.customBlocks,
		]) {
			if (block) {
				muggle.replaceSourceRange(
					str, undefined, block.startTagEnd, block.endTagStart,
					[
						block.content,
						undefined,
						block.startTagEnd,
						{},
					],
				);
			}
		}
		return str.map<Mapping<VueCodeInformation>>((m) => {
			const text = m[0];
			const start = m[2] as number;
			const end = start + text.length;
			return [
				undefined,
				[start, end],
				[start, end],
				m[3] as VueCodeInformation,
			];
		});
	});
}
