import type { Code } from '../../types';
import type { ScriptCodegenOptions } from '../script';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine } from '../utils';
import { generateClassProperty } from './classProperty';

export function* generateStyleScopedClasses(
	options: ScriptCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	const option = options.vueCompilerOptions.experimentalResolveStyleCssClasses;
	const styles = options.sfc.styles
		.map((style, i) => [style, i] as const)
		.filter(([style]) => option === 'always' || (option === 'scoped' && style.scoped));
	if (!styles.length) {
		return;
	}

	const firstClasses = new Set<string>();
	yield `type __VLS_StyleScopedClasses = {}`;
	for (const [style, i] of styles) {
		for (const className of style.classNames) {
			if (firstClasses.has(className.text)) {
				ctx.scopedClasses.push({
					source: 'style_' + i,
					className: className.text.slice(1),
					offset: className.offset + 1
				});
				continue;
			}
			firstClasses.add(className.text);
			yield* generateClassProperty(
				i,
				className.text,
				className.offset,
				'boolean'
			);
		}
	}
	yield endOfLine;
}
