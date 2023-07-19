import { hyphenate as _hyphenate } from '@vue/shared';

export function getSlotsPropertyName(vueVersion: number) {
	return vueVersion < 3 ? '$scopedSlots' : '$slots';
}

const cacheStringFunction = (fn: (str: string) => string) => {
	const cache: Record<string, string> = Object.create(null);
	return (str: string) => {
		const hit = cache[str];
		return hit || (cache[str] = fn(str));
	};
};

export const hyphenate = cacheStringFunction((str: string) => {
	let hyphencase = _hyphenate(str);
	// If it begins with capital letter
	if (str[0] === str[0].toUpperCase()) {
		hyphencase = '-' + hyphencase;
	}
	return hyphencase;
});