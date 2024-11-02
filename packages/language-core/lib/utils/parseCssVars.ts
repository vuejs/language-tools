// https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/cssVars.ts#L47-L61

const vBindCssVarReg = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([a-z_]\w*))\s*\)/gi;
export const commentReg = /(?<=\/\*)[\s\S]*?(?=\*\/)|(?<=\/\/)[\s\S]*?(?=\n)/g;

export function* parseCssVars(css: string) {
	css = fillBlank(css, commentReg);
	const matchs = css.matchAll(vBindCssVarReg);
	for (const match of matchs) {
		const matchText = match.slice(1).find(t => t);
		if (matchText) {
			const offset = match.index + css.slice(match.index).indexOf(matchText);
			yield { offset, text: matchText };
		}
	}
}

export function fillBlank(css: string, ...regs: RegExp[]) {
	for (const reg of regs) {
		css = css.replace(reg, match => ' '.repeat(match.length));
	}
	return css;
}