import type { Code, VueCodeInformation } from '../../types';
import { wrapWith } from '../common';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateObjectKey(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	code: string,
	offset: number,
	features: VueCodeInformation,
	astHolder?: any
): Generator<Code> {
	yield `[`;
	if (code.startsWith('[') && code.endsWith(']')) {
		yield* generateInterpolation(
			options,
			ctx,
			code.slice(1, -1),
			astHolder,
			offset,
			features,
			'',
			''
		);
	}
	else {
		yield `"`;
		yield* wrapWith(
			offset,
			offset + code.length,
			features,
			code,
		)
		yield `"`;
	}
	yield `]`;
}
