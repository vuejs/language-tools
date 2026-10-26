import type { VueCodeMarker } from '@vue/language-core';
import { camelize } from '@vue/shared';
import { names } from '../names';
import { Boundary, type TsCode } from '../tsCode';
import { identifierRE } from '../writers';
import { generateCamelized } from '../writers/camelized';
import { generateStringLiteralKey } from '../writers/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateObjectProperty(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	code: string,
	offset: number,
	features: VueCodeMarker,
	shouldCamelize = false,
	shouldBeConstant = false,
): Generator<TsCode> {
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
			yield* generateCamelized(code, 'template', offset);
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
