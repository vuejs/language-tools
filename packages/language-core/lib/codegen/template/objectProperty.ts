import { camelize } from '@vue/shared';
import type { Code, VueCodeInformation } from '../../types';
import { combineLastMapping, variableNameRegex, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateStringLiteralKey } from './stringLiteralKey';

export function* generateObjectProperty(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	code: string,
	offset: number,
	features: VueCodeInformation,
	astHolder?: any,
	shouldCamelize = false,
	shouldBeConstant = false
): Generator<Code> {
	if (code.startsWith('[') && code.endsWith(']') && astHolder) {
		if (shouldBeConstant) {
			yield* generateInterpolation(
				options,
				ctx,
				code.slice(1, -1),
				astHolder,
				offset + 1,
				features,
				`[__VLS_tryAsConstant(`,
				`)]`
			);
		}
		else {
			yield* generateInterpolation(options, ctx, code, astHolder, offset, features, '', '');
		}
	}
	else if (shouldCamelize) {
		if (variableNameRegex.test(camelize(code))) {
			yield* generateCamelized(code, offset, features);
		}
		else {
			yield* wrapWith(
				offset,
				offset + code.length,
				features,
				`"`,
				...generateCamelized(code, offset, combineLastMapping),
				`"`
			);
		}
	}
	else {
		if (variableNameRegex.test(code)) {
			yield [code, 'template', offset, features];
		}
		else {
			yield* generateStringLiteralKey(code, offset, features);
		}
	}
}
