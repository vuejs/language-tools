import { camelize } from '@vue/shared';
import type { Code, VueCodeInformation } from '../../types';
import { names } from '../names';
import { identifierRE } from '../utils';
import { Boundary } from '../utils/boundary';
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
				`[${names.tryAsConstant}(`,
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
		if (identifierRE.test(camelize(code))) {
			yield* generateCamelized(code, 'template', offset, features);
		}
		else {
			const boundary = yield* Boundary.start('template', offset, offset + code.length, features);
			yield `'`;
			yield* generateCamelized(code, 'template', offset, boundary.features);
			yield `'`;
			yield boundary.end();
		}
	}
	else {
		if (identifierRE.test(code)) {
			yield [code, 'template', offset, features];
		}
		else {
			yield* generateStringLiteralKey(code, offset, features);
		}
	}
}
