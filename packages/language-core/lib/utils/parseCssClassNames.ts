import { commentReg, fillBlank } from './parseCssVars';

const cssClassNameReg = /(?=(\.[a-z_][-\w]*)[\s.,+~>:#)[{])/gi;
const fragmentReg = /(?<={)[^{]*(?=(?<!\\);)/g;

export function* parseCssClassNames(css: string) {
	css = fillBlank(css, commentReg, fragmentReg);
	const matches = css.matchAll(cssClassNameReg);
	for (const match of matches) {
		const matchText = match[1];
		if (matchText) {
			yield { offset: match.index, text: matchText };
		}
	}
}
