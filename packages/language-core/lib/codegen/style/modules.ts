import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, generateTypeAlias, identifierRE, newLine } from '../utils';
import { Boundary } from '../utils/boundary';
import type { StyleCodegenOptions } from '.';
import { generateClassProperty, generateStyleImports } from './common';

export function* generateStyleModules(
	{ vueCompilerOptions, styles, scriptLang }: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	const styleModules = styles.filter(style => style.module);
	if (!styleModules.length) {
		return;
	}
	ctx.generatedTypes.add(names.StyleModules);

	yield* generateTypeAlias(names.StyleModules, scriptLang, function*() {
		yield `{${newLine}`;
		for (const style of styleModules) {
			if (style.module === true) {
				if (style.moduleAttrOffset === undefined) {
					yield `$style`;
				}
				else {
					yield [
						`$style`,
						'main',
						style.moduleAttrOffset,
						codeFeatures.verification,
					];
				}
			}
			else {
				const { text, offset } = style.module!;
				if (identifierRE.test(text)) {
					yield [
						text,
						'main',
						offset,
						codeFeatures.navigationAndVerification,
					];
				}
				else {
					const boundary = yield* Boundary.start(
						'main',
						offset,
						offset + text.length,
						codeFeatures.navigationAndVerification,
					);
					yield `'`;
					yield [text, 'main', offset, boundary.features];
					yield `'`;
					yield boundary.end();
				}
			}
			yield `: `;
			if (!vueCompilerOptions.strictCssModules) {
				yield `Record<string, string> & `;
			}
			yield `${names.PrettifyGlobal}<{}`;
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
		yield `}`;
	});
}
