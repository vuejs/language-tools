import { clearComments } from './parseCssVars';

export function* parseCssClassNames(styleContent: string) {
	styleContent = clearComments(styleContent);
	const cssClassNameRegex = /(?=([\.]{1}[a-zA-Z_]+[\w\_\-]*)[\s\.\+\{\>#\:]{1})/g;
	const matches = styleContent.matchAll(cssClassNameRegex);
	for (const match of matches) {
		if (match.index !== undefined) {
			const matchText = match[1];
			if (matchText !== undefined) {
				yield { offset: match.index, text: matchText };
			}
		}
	}
}
