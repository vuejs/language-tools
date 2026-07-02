import type { Code } from '../../types';
import { names } from '../names';
import type { TemplateCodegenContext } from '../template/context';
import { generateStyleScopedClassReference } from '../template/styleScopedClasses';
import { endOfLine } from '../utils';
import type { StyleCodegenOptions } from '.';
import { generateClassProperty, generateStyleImports } from './common';

export function* generateStyleScopedClasses(
	{ vueCompilerOptions, styles }: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	const { resolveStyleClassNames, resolveStyleImports } = vueCompilerOptions;
	if (!resolveStyleClassNames) {
		return;
	}
	const scopedStyles = styles.filter(style => resolveStyleClassNames === true || style.scoped);
	if (!scopedStyles.length) {
		return;
	}
	ctx.generatedTypes.add(names.StyleScopedClasses);

	const visited = new Set<string>();
	const deferredGenerates: Generator<Code>[] = [];
	yield `type ${names.StyleScopedClasses} = {}`;
	for (const style of scopedStyles) {
		if (resolveStyleImports) {
			yield* generateStyleImports(style);
		}
		for (const className of style.classNames) {
			if (!visited.has(className.text)) {
				visited.add(className.text);
				yield* generateClassProperty(style.name, className.text, className.offset, 'boolean');
			}
			else {
				deferredGenerates.push(
					generateStyleScopedClassReference(style, className.text.slice(1), className.offset + 1),
				);
			}
		}
	}
	yield endOfLine;

	for (const generate of deferredGenerates) {
		yield* generate;
	}
}
