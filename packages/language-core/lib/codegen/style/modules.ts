import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { ScriptCodegenOptions } from '../script';
import { endOfLine, newLine } from '../utils';
import { generateClassProperty, generateStyleImports } from './common';

export function* generateStyleModules(
	{ styles, scriptSetupRanges, vueCompilerOptions }: ScriptCodegenOptions,
): Generator<Code> {
	const styleModules = styles.filter(style => style.module);
	if (!styleModules.length && !scriptSetupRanges?.useCssModule.length) {
		return;
	}
	yield `type __VLS_StyleModules = {${newLine}`;
	for (const style of styleModules) {
		if (style.module === true) {
			yield `$style`;
		}
		else {
			const { text, offset } = style.module!;
			yield [
				text,
				'main',
				offset,
				codeFeatures.navigation,
			];
		}
		yield `: `;
		if (!vueCompilerOptions.strictCssModules) {
			yield `Record<string, string> & `;
		}
		yield `__VLS_PrettifyGlobal<{}`;
		if (vueCompilerOptions.resolveStyleImports) {
			yield* generateStyleImports(style);
		}
		for (const className of style.classNames) {
			yield* generateClassProperty(
				style.name,
				className.text,
				className.offset,
				'string',
			);
		}
		yield `>${endOfLine}`;
	}
	yield `}${endOfLine}`;
}
