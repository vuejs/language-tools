import type { IRScript, IRScriptSetup, VueCodeMarker, VueCompilerOptions } from '@vue/language-core';
import { Boundary, synthesizedIgnore, type TsCode } from '../../boundary';

export const newLine = `\n`;
export const endOfLine = `;${newLine}`;
export const identifierRE = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export function isTsLang(lang: string): boolean {
	return lang === 'ts' || lang === 'tsx';
}

// `{} as T` in TS; `/** @type {T} */ ({})` in JS. The JSDoc cast keeps the
// same assertion semantics under checkJs, and requires no type-only syntax.
export function asType(type: string, lang: string): string {
	return isTsLang(lang) ? `{} as ${type}` : `/** @type {${type}} */ ({})`;
}

// `let name!: T;` in TS; `var name = /** @type {T} */ ({});` in JS.
export function* generateTypedVar(
	kind: 'let' | 'var',
	name: string,
	lang: string,
	type: () => Generator<TsCode>,
): Generator<TsCode> {
	if (isTsLang(lang)) {
		yield `${kind} ${name}!: `;
		yield* type();
		yield endOfLine;
	}
	else {
		yield `var ${name} = /** @type {`;
		yield* type();
		yield `} */ ({})${endOfLine}`;
	}
}

// `type name = T;` in TS; `var name = /** @type {T} */ ({});` in JS, where every
// top-level `@typedef` is an export of the module and would leak into the emitted
// declarations. Refer to the alias through `typeAliasRef`.
export function* generateTypeAlias(
	name: string,
	lang: string,
	type: () => Generator<TsCode>,
): Generator<TsCode> {
	if (isTsLang(lang)) {
		yield `type ${name} = `;
		yield* type();
		yield endOfLine;
	}
	else {
		yield* generateTypedVar('var', name, lang, type);
	}
}

export function typeAliasRef(name: string, lang: string): string {
	return isTsLang(lang) ? name : `typeof ${name}`;
}

// The phantom argument that carries the component library's `Ref` brand into
// `__VLS_unwrap` / `__VLS_withDotValue`; the helper declarations cannot
// resolve the library import themselves.
export function getRefBrandArgument(vueCompilerOptions: VueCompilerOptions, lang: string): string {
	return asType(`import('${vueCompilerOptions.lib}').Ref<unknown>`, lang);
}

export function* generateSfcBlockSection(
	block: IRScript | IRScriptSetup,
	start: number,
	end: number,
	features: VueCodeMarker,
	ignoreDiagnostics = false,
): Generator<TsCode> {
	const text = block.content.slice(start, end);
	const ignore = ignoreDiagnostics ? yield* Boundary.start(block.name, 0, 0, synthesizedIgnore) : undefined;
	yield [text, block.name, start, features];
	if (ignore) {
		yield ignore.end();
	}

	// #3632
	if ('parseDiagnostics' in block.ast) {
		const textEnd = text.trimEnd().length;
		for (const diag of block.ast.parseDiagnostics as { start: number; length: number }[]) {
			const diagStart = diag.start;
			const diagEnd = diag.start + diag.length;
			if (diagStart >= textEnd && diagEnd <= end) {
				// map the synthesized terminator to the end of the section, so that
				// truncation parse errors resolve back to the original block
				yield [';', block.name, end, { features: 0 }];
				yield newLine;
				break;
			}
		}
	}
}
