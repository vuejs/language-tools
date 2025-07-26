import type { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.1,

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
const cssBindingReg = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([a-z_]\w*))\s*\)/gi;
const cssClassNameReg = /(?=(\.[a-z_][-\w]*)[\s.,+~>:#)[{])/gi;
const commentReg = /(?<=\/\*)[\s\S]*?(?=\*\/)|(?<=\/\/)[\s\S]*?(?=\n)/g;
const fragmentReg = /(?<={)[^{]*(?=(?<!\\);)/g;

function* parseCssImports(css: string) {
	const matches = css.matchAll(cssImportReg);
	for (const match of matches) {
		let text = match[0];
		let offset = match.index;
		if (text.startsWith("'") || text.startsWith('"')) {
			text = text.slice(1, -1);
			offset += 1;
		}
		if (text) {
			yield { text, offset };
		}
	}
}

function* parseCssBindings(css: string) {
	css = fillBlank(css, commentReg);
	const matchs = css.matchAll(cssBindingReg);
	for (const match of matchs) {
		const matchText = match.slice(1).find(t => t);
		if (matchText) {
			const offset = match.index + css.slice(match.index).indexOf(matchText);
			yield { offset, text: matchText };
		}
	}
}

function* parseCssClassNames(css: string) {
	css = fillBlank(css, commentReg, fragmentReg);
	const matches = css.matchAll(cssClassNameReg);
	for (const match of matches) {
		const matchText = match[1];
		if (matchText) {
			yield { offset: match.index, text: matchText };
		}
	}
}

function fillBlank(css: string, ...regs: RegExp[]) {
	for (const reg of regs) {
		css = css.replace(reg, match => ' '.repeat(match.length));
	}
	return css;
}
