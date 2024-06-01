import type { Code, VueCodeInformation } from '../../types';
import { variableNameRegex } from '../common';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateStringLiteralKey } from './stringLiteralKey';

export function* generatePropertyAccess(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	code: string,
	offset?: number,
	features?: VueCodeInformation,
	astHolder?: any
): Generator<Code> {
	if (!options.compilerOptions.noPropertyAccessFromIndexSignature && variableNameRegex.test(code)) {
		yield `.`;
		yield offset !== undefined && features
			? [code, 'template', offset, features]
			: code;
	}
	else if (code.startsWith('[') && code.endsWith(']')) {
		yield* generateInterpolation(
			options,
			ctx,
			code,
			astHolder,
			offset,
			features,
			'',
			''
		);
	}
	else {
		yield `[`;
		yield* generateStringLiteralKey(code, offset, features);
		yield `]`;
	}
}
