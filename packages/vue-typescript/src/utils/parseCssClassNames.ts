// https://gist.github.com/Potherca/f2a65491e63338659c3a0d2b07eee382
export function* parseCssClassNames(styleContent: string) {
	const reg = /\.[a-z]([a-z0-9-]+)?(__([a-z0-9]+-?)+)?(--([a-z0-9]+-?)+){0,2}/g;
	const matchs = styleContent.matchAll(reg);
	for (const match of matchs) {
		if (match.index !== undefined) {
			const matchText = match[0];
			if (matchText !== undefined) {
				yield { start: match.index, end: match.index + matchText.length };
			}
		}
	}
}
