import type { VueCodeMarker } from '@vue/language-core';
import type { TsCode } from '../tsCode';
import { identifierRE } from '../writers';
import { generateStringLiteralKey } from '../writers/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generatePropertyAccess(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	code: string,
	offset: number,
	features: VueCodeMarker,
): Generator<TsCode> {
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
	else if (identifierRE.test(code)) {
		yield `.`;
		yield [code, options.template, offset, features];
	}
	else {
		yield `[`;
		yield* generateStringLiteralKey(code, options.template, offset, features);
		yield `]`;
	}
}
