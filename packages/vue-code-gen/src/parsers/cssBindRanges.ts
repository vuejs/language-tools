export function* getMatchBindTexts(nodeText: string) {
	const reg = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([^'"][^)]*))\s*\)/g;
	const matchs = nodeText.matchAll(reg);
	for (const match of matchs) {
		if (match.index !== undefined) {
			const matchText = match[1] ?? match[2] ?? match[3];
			if (matchText !== undefined) {
				const offset = match.index + nodeText.slice(match.index).indexOf(matchText);
				yield { start: offset, end: offset + matchText.length };
			}
		}
	}
}
