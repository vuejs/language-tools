import type { Code } from '../../types';
import type { ScriptCodegenOptions } from '../script';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine } from '../utils';
import { generateClassProperty } from './classProperty';
import { generateExternalStylesheets } from './externalStylesheet';

export function* generateStyleScopedClasses(
	options: ScriptCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	const firstClasses = new Set<string>();
	yield `type __VLS_StyleScopedClasses = {}`;
	for (let i = 0; i < options.sfc.styles.length; i++) {
		const style = options.sfc.styles[i];
		const option = options.vueCompilerOptions.experimentalResolveStyleCssClasses;
		if (option === 'always' || (option === 'scoped' && style.scoped)) {
			if (options.vueCompilerOptions.experimentalResolveExternalStylesheets) {
				yield* generateExternalStylesheets(style);
			}
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
					'boolean',
					true
				);
			}
		}
	}
	yield endOfLine;
}
