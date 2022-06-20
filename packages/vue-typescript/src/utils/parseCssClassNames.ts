import { clearComments } from './parseCssVars';

export function* parseCssClassNames(styleContent: string) {
	styleContent = clearComments(styleContent);
	const cssClassNameRegex = /(?=[\.]{1}([a-zA-Z_]+[\w\_\-]*)[\s\.\+\{\>#\:]{1})/g;
	const matchs = styleContent.matchAll(cssClassNameRegex);
	for (const match of matchs) {
		if (match.index !== undefined) {
			const matchText = match[1];
			if (matchText !== undefined) {
				yield { start: match.index, end: match.index + matchText.length };
			}
		}
	}
}
