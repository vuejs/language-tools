import { type IR, type IRStyle, navigationFeatures } from '@vue/language-core';
import { names } from '../names';
import type { TemplateCodegenContext } from '../template/context';
import { Boundary, mapped, type TsCode } from '../tsCode';
import { endOfLine, generateTypeAlias, identifierRE, newLine } from '../writers';
import type { StyleCodegenOptions } from '.';
import { generateClassProperty, generateStyleSrc } from './common';

/**
 * `<style module src>` is typed by an ordinary import of the src, so whatever types that module
 * (a CSS content mapper, an ambient declaration) types the CSS module; Vue does not read the file.
 */
export function* generateStyleModuleImports(ir: IR): Generator<TsCode[]> {
	for (const style of ir.styles) {
		if (style.module && typeof style.src === 'object') {
			yield [`import ${getStyleModuleImportName(style)} from `, ...generateStyleSrc(ir, style.src), `;`];
		}
	}
}

function getStyleModuleImportName(style: IRStyle) {
	return `__VLS_${style.name}`;
}

export function* generateStyleModules(
	{ ir, vueCompilerOptions, styles, scriptLang }: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<TsCode> {
	const styleModules = styles.filter(style => style.module);
	if (!styleModules.length) {
		return;
	}
	ctx.generatedTypes.add(names.StyleModules);

	yield* generateTypeAlias(names.StyleModules, scriptLang, function*() {
		yield `{${newLine}`;
		for (const style of styleModules) {
			if (style.module === true) {
				yield `$style`;
			}
			else {
				const { text, offset } = style.module!;
				if (!text) {
					yield mapped(`$style`, ir, offset, { features: 0 });
				}
				else if (identifierRE.test(text)) {
					yield mapped(text, ir, offset, { features: navigationFeatures });
				}
				else {
					const boundary = yield* Boundary.start(
						ir,
						offset,
						offset + text.length,
						{ features: navigationFeatures },
					);
					yield `'`;
					yield mapped(text, ir, offset, undefined);
					yield `'`;
					yield boundary.end();
				}
			}
			yield `: `;
			if (!vueCompilerOptions.strictCssModules) {
				yield `Record<string, string> & `;
			}
			yield `${names.PrettifyGlobal}<{}`;
			if (typeof style.src === 'object') {
				yield `${newLine} & typeof ${getStyleModuleImportName(style)}`;
			}
			for (const className of style.classNames) {
				yield* generateClassProperty(
					style,
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
