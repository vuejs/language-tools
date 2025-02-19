import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { ScriptCodegenOptions } from '../script';
import { endOfLine, newLine } from '../utils';
import { generateClassProperty } from './classProperty';

export function* generateStyleModules(
	options: ScriptCodegenOptions
): Generator<Code> {
	const styles = options.sfc.styles.map((style, i) => [style, i] as const).filter(([style]) => style.module);
	if (!styles.length && !options.scriptSetupRanges?.useCssModule.length) {
		return;
	}
	yield `type __VLS_StyleModules = {${newLine}`;
	for (const [style, i] of styles) {
		if (style.module === true) {
			yield `$style`;
		}
		else {
			const { text, offset } = style.module!;
			yield [
				text,
				'main',
				offset,
				codeFeatures.withoutHighlight
			];
		}
		yield `: Record<string, string> & __VLS_PrettifyGlobal<{}`;
		for (const className of style.classNames) {
			yield* generateClassProperty(
				i,
				className.text,
				className.offset,
				'string'
			);
		}
		yield `>${endOfLine}`;
	}
	yield `}${endOfLine}`;
}
