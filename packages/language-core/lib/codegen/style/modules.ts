import type { Code } from '../../types';
import type { ScriptCodegenContext } from '../script/context';
import { ScriptCodegenOptions, codeFeatures } from '../script/index';
import { endOfLine, newLine } from '../utils';
import { generateClassProperty } from './classProperty';
import { generateExternalStylesheets } from './externalStylesheets';

export function* generateStyleModules(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext
): Generator<Code> {
	const styles = options.sfc.styles.map((style, i) => [style, i] as const).filter(([style]) => style.module);
	if (!styles.length && !options.scriptSetupRanges?.useCssModule.length) {
		return;
	}
	yield `type __VLS_StyleModules = {${newLine}`;
	for (const [style, i] of styles) {
		if (style.module === true) {
			yield '$style';
		}
		else {
			const { text, offset } = style.module!;
			yield [
				text,
				'main',
				offset,
				codeFeatures.navigation
			];
		}
		yield `: Record<string, string> & ${ctx.localTypes.PrettifyLocal}<{}`;
		if (options.vueCompilerOptions.experimentalResolveExternalStylesheets) {
			yield* generateExternalStylesheets(style);
		}
		for (const { text, offset } of style.classNames) {
			yield* generateClassProperty(
				i,
				text,
				offset,
				'string',
				false
			);
		}
		yield `>${endOfLine}`;
	}
	yield `}${endOfLine}`;
}
