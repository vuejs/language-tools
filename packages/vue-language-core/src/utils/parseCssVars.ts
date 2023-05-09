// https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/cssVars.ts#L47-L61
export function* parseCssVars(styleContent: string) {
	styleContent = clearComments(styleContent);
	const reg = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([^'"][^)]*))\s*\)/g;
	const matchs = styleContent.matchAll(reg);
	for (const match of matchs) {
		if (match.index !== undefined) {
			const matchText = match[1] ?? match[2] ?? match[3];
			if (matchText !== undefined) {
				const offset = match.index + styleContent.slice(match.index).indexOf(matchText);
				yield { offset, text: matchText };
			}
		}
	}
}

export function clearComments(css: string) {
	return css
		.replace(/\/\*([\s\S]*?)\*\//g, match => `/*${' '.repeat(match.length - 4)}*/`)
		.replace(/\/\/([\s\S]*?)\n/g, match => `//${' '.repeat(match.length - 3)}\n`);
}
