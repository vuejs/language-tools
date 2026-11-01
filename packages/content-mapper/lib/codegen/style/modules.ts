import { type IR, type IRAttr, type IRStyle, navigationFeatures, type VueCompilerOptions } from '@vue/language-core';
import { names } from '../names';
import { Boundary, mapped, type TsCode } from '../tsCode';
import { endOfLine, identifierRE, newLine } from '../writers';
import { generateClassProperty, generateStyleSrc } from './common';

/**
 * `<style module src>` is typed by an ordinary import of the src, so whatever types that module
 * (a CSS content mapper, an ambient declaration) types the CSS module; Vue does not read the file.
 */
export function* generateStyleModuleImports(
	ir: IR,
	imports: readonly StyleModuleImport[],
): Generator<TsCode[]> {
	for (const { name, src } of imports) {
		yield [`import ${name} from `, ...generateStyleSrc(ir, src), `;`];
	}
}

/** The import of the src of a CSS module, by the name that the style plugin gave it. */
export interface StyleModuleImport {
	style: IRStyle;
	src: Exclude<IRAttr, true>;
	name: string;
}

/** The type of the CSS modules of `styleModules`, by their names; one with a src reads its import of `imports`. */
export function* generateStyleModulesType(
	ir: IR,
	vueCompilerOptions: VueCompilerOptions,
	styleModules: readonly IRStyle[],
	imports: readonly StyleModuleImport[],
): Generator<TsCode> {
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
		const moduleImport = imports.find(moduleImport => moduleImport.style === style);
		if (moduleImport) {
			yield `${newLine} & typeof ${moduleImport.name}`;
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
}
