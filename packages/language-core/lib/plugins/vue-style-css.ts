import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		compileSFCStyle(_lang, style) {
			return {
				imports: [...parseCssImports(style)],
				bindings: [...parseCssBindings(style)],
				classNames: [...parseCssClassNames(style)],
			};
		},
	};
};

export default plugin;

const cssImportReg = /(?<=@import\s+url\()(["']?).*?\1(?=\))|(?<=@import\b\s*)(["']).*?\2/g;
const cssBindingReg = /\bv-bind\s*\(/g;
const cssClassNameReg = /\.[a-z_][-\w]*(?=[\s.,+~>:#)[{])/gi;
const commentReg = /(?<=\/\*)[\s\S]*?(?=\*\/)|(?<=\/\/)[\s\S]*?(?=\n)/g;
const fragmentReg = /(?<={)[^{]*(?=(?<!\\);)/g;

function* parseCssImports(css: string) {
	for (const match of css.matchAll(cssImportReg)) {
		yield trimQuotes(match[0], match.index);
	}
}

function* parseCssBindings(css: string) {
	css = fillBlank(css, commentReg);
	for (const match of css.matchAll(cssBindingReg)) {
		const start = match.index + match[0].length;
		const end = lexBinding(css, start);
		if (end !== null) {
			yield trimQuotes(css.slice(start, end), start, false);
		}
	}
}

enum LexerState {
	inParens,
	inSingleQuoteString,
	inDoubleQuoteString,
}

// https://github.com/vuejs/core/blob/c0606e91798c8dca4f33d101e1dd836d672592c1/packages/compiler-sfc/src/style/cssVars.ts#L93
function lexBinding(content: string, start: number) {
	let state: LexerState = LexerState.inParens;
	let parenDepth = 0;

	for (let i = start; i < content.length; i++) {
		const char = content.charAt(i);
		switch (state) {
			case LexerState.inParens:
				if (char === `'`) {
					state = LexerState.inSingleQuoteString;
				}
				else if (char === `"`) {
					state = LexerState.inDoubleQuoteString;
				}
				else if (char === `(`) {
					parenDepth++;
				}
				else if (char === `)`) {
					if (parenDepth > 0) {
						parenDepth--;
					}
					else {
						return i;
					}
				}
				break;
			case LexerState.inSingleQuoteString:
				if (char === `'`) {
					state = LexerState.inParens;
				}
				break;
			case LexerState.inDoubleQuoteString:
				if (char === `"`) {
					state = LexerState.inParens;
				}
				break;
		}
	}
	return null;
}

function* parseCssClassNames(css: string) {
	css = fillBlank(css, commentReg, fragmentReg);
	for (const match of css.matchAll(cssClassNameReg)) {
		yield { text: match[0], offset: match.index };
	}
}

function fillBlank(css: string, ...regs: RegExp[]) {
	for (const reg of regs) {
		css = css.replace(reg, match => ' '.repeat(match.length));
	}
	return css;
}

function trimQuotes(text: string, offset: number, trim = true) {
	let start = 0;
	let end = text.length;

	if (trim || text.includes('"') || text.includes("'")) {
		while (start < text.length && !text[start]?.trim()) {
			start++;
		}
		while (end >= 0 && !text[end - 1]?.trim()) {
			end--;
		}
	}

	if (
		text[start] === '"' && text[end - 1] === '"'
		|| text[start] === "'" && text[end - 1] === "'"
	) {
		start++;
		end--;
	}

	return {
		text: text.slice(start, end),
		offset: offset + start,
	};
}
