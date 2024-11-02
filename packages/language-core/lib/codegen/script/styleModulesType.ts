import type { Code } from '../../types';
import { endOfLine, newLine } from '../utils';
import type { ScriptCodegenContext } from './context';
import { ScriptCodegenOptions, codeFeatures } from './index';
import { generateCssClassProperty } from './template';

export function* generateStyleModulesType(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext
): Generator<Code> {
	const styles = options.sfc.styles.map((style, i) => [style, i] as const).filter(([style]) => style.module);
	if (!styles.length && !options.scriptSetupRanges?.cssModules.length) {
		return;
	}
	yield `type __VLS_StyleModules = {${newLine}`;
	for (const [style, i] of styles) {
		const { name, offset } = style.module!;
		if (offset) {
			yield [
				name,
				'main',
				offset + 1,
				codeFeatures.all
			];
		}
		else {
			yield name;
		}
		yield `: Record<string, string> & ${ctx.localTypes.PrettifyLocal}<{}`;
		for (const className of style.classNames) {
			yield* generateCssClassProperty(
				i,
				className.text,
				className.offset,
				'string',
				false
			);
		}
		yield `>${endOfLine}`;
	}
	yield `}${endOfLine}`;
}