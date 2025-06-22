const cssImportReg = /(?<=@import\s+url\()(["']?).*?\1(?=\))|(?<=@import\b\s*)(["']).*?\2/g;

export function* parseCssImports(css: string) {
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
