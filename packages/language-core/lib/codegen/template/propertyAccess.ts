import type { Code, VueCodeInformation } from '../../types';
import { identifierRegex } from '../utils';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generatePropertyAccess(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	code: string,
	offset: number,
	features: VueCodeInformation,
): Generator<Code> {
	if (code.startsWith('[') && code.endsWith(']')) {
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			features,
			code,
			offset,
		);
	}
	else if (identifierRegex.test(code)) {
		yield `.`;
		yield [code, 'template', offset, features];
	}
	else {
		yield `[`;
		yield* generateStringLiteralKey(code, offset, features);
		yield `]`;
	}
}
