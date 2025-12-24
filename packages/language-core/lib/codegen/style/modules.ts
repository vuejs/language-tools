import camelCase from "lodash.camelcase";
import type { Code, LocalsConvention } from '../../types';
import { codeFeatures } from '../codeFeatures';
import * as names from '../names';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, newLine } from '../utils';
import type { StyleCodegenOptions } from '.';
import { generateClassProperty, generateStyleImports } from './common';

// See https://github.com/madyankin/postcss-modules/blob/master/src/localsConvention.js

function dashesCamelCase(string: string) {
	return string.replace(/-+(\w)/g, (_, firstLetter) => firstLetter.toUpperCase());
}

function generateClasses(classNameWithoutDot: string, localsConvention: LocalsConvention): string[] {
	switch (localsConvention) {
		case "camelCase":
			return [classNameWithoutDot, camelCase(classNameWithoutDot)];

		case "camelCaseOnly":
			return [camelCase(classNameWithoutDot)];

		case "dashes":
			return [classNameWithoutDot, dashesCamelCase(classNameWithoutDot)];

		case "dashesOnly":
			return [dashesCamelCase(classNameWithoutDot)];
	}
	return [classNameWithoutDot];
}

export function* generateStyleModules(
	{ styles, vueCompilerOptions }: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	const styleModules = styles.filter(style => style.module);
	if (!styleModules.length) {
		return;
	}
	ctx.generatedTypes.add(names.StyleModules);

	yield `type ${names.StyleModules} = {${newLine}`;
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
		for (const classNameWithDot of style.classNames) {
			const moduleClassNamesWithoutDot = generateClasses(classNameWithDot.text.slice(1), vueCompilerOptions.cssModulesLocalsConvention);
			for (const moduleClassNameWithoutDot of moduleClassNamesWithoutDot) {
				yield* generateClassProperty(
					style.name,
					`.${moduleClassNameWithoutDot}`,
					classNameWithDot.offset,
					'string',
				);
			}
		}
		yield `>${endOfLine}`;
	}
	yield `}${endOfLine}`;
}
