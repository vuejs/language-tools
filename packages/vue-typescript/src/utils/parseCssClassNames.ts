import { clearComments } from './parseCssVars';

export function* parseCssClassNames(styleContent: string) {
	styleContent = clearComments(styleContent);
	const cssClassNameRegex = /\.([\w-]+)/g;
	const matchs = styleContent.matchAll(cssClassNameRegex);
	for (const match of matchs) {
		if (match.index !== undefined) {
			const matchText = match[0];
			if (matchText !== undefined) {
				yield { start: match.index, end: match.index + matchText.length };
			}
		}
	}
}
