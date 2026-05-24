import type { Code } from '../../types';
import { names } from '../names';
import { generateStyleScopedClassReference } from '../template/styleScopedClasses';
import { endOfLine } from '../utils';
import type { StyleCodegenOptions } from '.';
import { generateClassProperty, generateStyleImports } from './common';

export function* generateStyleScopedClasses(
	{ vueCompilerOptions, styles }: StyleCodegenOptions,
): Generator<Code> {
	const { resolveStyleClassNames, resolveStyleImports } = vueCompilerOptions;
	if (!resolveStyleClassNames) {
		return;
	}
	const scopedStyles = styles.filter(style => resolveStyleClassNames === true || style.scoped);
	if (!scopedStyles.length) {
		return;
	}
	const visited = new Set<string>();
	const deferredGenerations: Generator<Code>[] = [];
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
				deferredGenerations.push(
					generateStyleScopedClassReference(style, className.text.slice(1), className.offset + 1),
				);
			}
		}
	}
	yield endOfLine;
	for (const generate of deferredGenerations) {
		yield* generate;
	}
}
