import { hyphenate } from '@vue/shared';

export function getSlotsPropertyName(vueVersion: number) {
	return vueVersion < 3 ? '$scopedSlots' : '$slots';
}

export { hyphenate as hyphenateTag } from '@vue/shared';

export function hyphenateAttr(str: string) {
	let hyphencase = hyphenate(str);
	// fix https://github.com/vuejs/core/issues/8811
	if (str.length && str[0] !== str[0].toLowerCase()) {
		hyphencase = '-' + hyphencase;
	}
	return hyphencase;
}
