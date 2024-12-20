import type { Code } from '../../types';
import { endOfLine } from '../utils';
import type { TemplateCodegenContext } from './context';

export function* generateStyleScopedClassReferences(
	ctx: TemplateCodegenContext,
	withDot = false
): Generator<Code> {
	if (!ctx.emptyClassOffsets.length && !ctx.scopedClasses.length) {
		return;
	}

	yield `[`;
	for (const offset of ctx.emptyClassOffsets) {
		yield `'`;
		yield [
			'',
			'template',
			offset,
			ctx.codeFeatures.additionalCompletion,
		];
		yield `', `;
	}
	for (const { source, className, offset } of ctx.scopedClasses) {
		yield [
			'',
			source,
			offset - (withDot ? 1 : 0),
			ctx.codeFeatures.navigation,
		];
		yield `'`;

		// fix https://github.com/vuejs/language-tools/issues/4537
		yield* escapeString(source, className, offset, ['\\', '\'']);
		yield `'`;
		yield [
			'',
			source,
			offset + className.length,
			ctx.codeFeatures.navigationWithoutRename,
		];
		yield `, `;
	}
	yield `] as (keyof __VLS_StyleScopedClasses)[]${endOfLine}`;

	function* escapeString(source: string, className: string, offset: number, escapeTargets: string[]): Generator<Code> {
		let count = 0;

		const currentEscapeTargets = [...escapeTargets];
		const firstEscapeTarget = currentEscapeTargets.shift()!;
		const splitted = className.split(firstEscapeTarget);

		for (let i = 0; i < splitted.length; i++) {
			const part = splitted[i];
			const partLength = part.length;

			if (escapeTargets.length > 0) {
				yield* escapeString(source, part, offset + count, [...currentEscapeTargets]);
			} else {
				yield [
					part,
					source,
					offset + count,
					ctx.codeFeatures.navigationAndAdditionalCompletion,
				];
			}

			if (i !== splitted.length - 1) {
				yield '\\';

				yield [
					firstEscapeTarget,
					source,
					offset + count + partLength,
					ctx.codeFeatures.navigationAndAdditionalCompletion,
				];

				count += partLength + 1;
			} else {
				count += partLength;
			}
		}
	}
}