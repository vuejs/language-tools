// https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/cssVars.ts#L47-L61

const vBindCssVarReg = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([a-z_]\w*))\s*\)/gi;
const commentReg1 = /\/\*([\s\S]*?)\*\//g;
const commentReg2 = /\/\/([\s\S]*?)\n/g;

export function* parseCssVars(styleContent: string) {
	styleContent = clearComments(styleContent);
	const matchs = styleContent.matchAll(vBindCssVarReg);
	for (const match of matchs) {
		const matchText = match.slice(1).find(t => t);
		if (matchText) {
			const offset = match.index + styleContent.slice(match.index).indexOf(matchText);
			yield { offset, text: matchText };
		}
	}
}

export function clearComments(css: string) {
	return css
		.replace(commentReg1, match => `/*${' '.repeat(match.length - 4)}*/`)
		.replace(commentReg2, match => `//${' '.repeat(match.length - 3)}\n`);
}
