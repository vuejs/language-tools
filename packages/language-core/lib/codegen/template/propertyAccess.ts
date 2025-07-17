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
	offset?: number,
	features?: VueCodeInformation,
): Generator<Code> {
	if (!options.compilerOptions.noPropertyAccessFromIndexSignature && identifierRegex.test(code)) {
		yield `.`;
		yield offset !== undefined && features
			? [code, 'template', offset, features]
			: code;
	}
	else if (code.startsWith('[') && code.endsWith(']')) {
		yield* generateInterpolation(
			options,
			ctx,
			'template',
			features,
			code,
			offset,
		);
	}
	else {
		yield `[`;
		yield* generateStringLiteralKey(code, offset, features);
		yield `]`;
	}
}
