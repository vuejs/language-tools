import { clearComments } from './parseCssVars';

const cssClassNameReg = /(?=([\.]{1}[a-zA-Z_]+[\w\_\-]*)[\s\.\+\{\>#\:]{1})/g;

export function* parseCssClassNames(styleContent: string) {
	styleContent = clearComments(styleContent);
	const matches = styleContent.matchAll(cssClassNameReg);
	for (const match of matches) {
		if (match.index !== undefined) {
			const matchText = match[1];
			if (matchText !== undefined) {
				yield { offset: match.index, text: matchText };
			}
		}
	}
}
