import { camelize } from '@vue/shared';
import type { Code, VueCodeInformation } from '../../types';
import { identifierRegex } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateObjectProperty(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	code: string,
	offset: number,
	features: VueCodeInformation,
	shouldCamelize = false,
	shouldBeConstant = false,
): Generator<Code> {
	if (code.startsWith('[') && code.endsWith(']')) {
		if (shouldBeConstant) {
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				features,
				code.slice(1, -1),
				offset + 1,
				`[__VLS_tryAsConstant(`,
				`)]`,
			);
		}
		else {
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				features,
				code,
				offset,
			);
		}
	}
	else if (shouldCamelize) {
		if (identifierRegex.test(camelize(code))) {
			yield* generateCamelized(code, 'template', offset, features);
		}
		else {
			const token = yield* startBoundary('template', offset, features);
			yield `'`;
			yield* generateCamelized(code, 'template', offset, { __combineToken: token });
			yield `'`;
			yield endBoundary(token, offset + code.length);
		}
	}
	else {
		if (identifierRegex.test(code)) {
			yield [code, 'template', offset, features];
		}
		else {
			yield* generateStringLiteralKey(code, offset, features);
		}
	}
}
