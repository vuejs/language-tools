import { hyphenate as _hyphenate } from '@vue/shared';

export function getSlotsPropertyName(vueVersion: number) {
	return vueVersion < 3 ? '$scopedSlots' : '$slots';
}

export function hyphenate(str: string) {
	let hyphencase = _hyphenate(str);
	// Fix https://github.com/vuejs/core/issues/8811
	if (str[0] === str[0].toUpperCase()) {
		hyphencase = '-' + hyphencase;
	}
	return hyphencase;
}
