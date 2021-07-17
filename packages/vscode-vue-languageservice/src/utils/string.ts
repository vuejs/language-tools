export enum SearchTexts {
	Context = '/* __VLS_.SearchTexts.Context */',
	Components = '/* __VLS_.SearchTexts.Components */',
	Props = '/* __VLS_.SearchTexts.Props */',
	SetupReturns = '/* __VLS_.SearchTexts.SetupReturns */',
	HtmlElements = '/* __VLS_.SearchTexts.HtmlElements */',
	GlobalAttrs = '/* __VLS_.SearchTexts.GlobalAttrs */',
	Ref = '/* __VLS_.SearchTexts.ref */',
}

export function replaceToComment(str: string, start: number, end: number) {
	if (Math.abs(end - start) >= 4) {
		return str.substring(0, start) + '/*' + ' '.repeat(Math.abs(end - start) - 4) + '*/' + str.substring(end);
	}
	return str.substring(0, start) + ' '.repeat(Math.abs(end - start)) + str.substring(end);
}
