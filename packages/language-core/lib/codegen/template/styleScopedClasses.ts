import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { generateEscaped } from '../utils/escaped';
import type { TemplateCodegenContext } from './context';

const classNameEscapeRegex = /([\\'])/;

export function* generateStyleScopedClassReferences(
	ctx: TemplateCodegenContext,
	withDot = false,
): Generator<Code> {
	for (const offset of ctx.emptyClassOffsets) {
		yield `/** @type {__VLS_StyleScopedClasses['`;
		yield ['', 'template', offset, codeFeatures.additionalCompletion];
		yield `']} */${endOfLine}`;
	}
	for (const { source, className, offset } of ctx.scopedClasses) {
		yield `/** @type {__VLS_StyleScopedClasses[`;
		const token = yield* startBoundary(source, offset - (withDot ? 1 : 0), codeFeatures.navigation);
		yield `'`;
		yield* generateEscaped(
			className,
			source,
			offset,
			codeFeatures.navigationAndAdditionalCompletion,
			classNameEscapeRegex,
		);
		yield `'`;
		yield endBoundary(token, offset + className.length);
		yield `]} */${endOfLine}`;
	}
}
