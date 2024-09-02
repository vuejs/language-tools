import type { Code } from '../../types';
import type { ScriptCodegenContext } from '../script/context';
import { type ScriptCodegenOptions, codeFeatures } from '../script';
import { generateCssClassProperty } from '../script/template';
import { endOfLine, newLine } from '../common';

export function* generateStyleModules(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext
): Generator<Code> {
	const styles = options.sfc.styles.filter(style => style.module);
	if (!styles.length) {
		return;
	}
	yield `type __VLS_StyleModules = {${newLine}`;
	for (let i = 0; i < styles.length; i++) {
		const style = styles[i];
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
	yield `}`;
	yield endOfLine;
}