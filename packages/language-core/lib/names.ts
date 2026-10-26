import { camelize, capitalize, hyphenate } from '@vue/shared';
import * as path from 'path-browserify';

export { hyphenate as hyphenateTag } from '@vue/shared';

export function hyphenateAttr(str: string) {
	let hyphencase = hyphenate(str);
	// fix https://github.com/vuejs/core/issues/8811
	if (str.length && str[0] !== str[0]!.toLowerCase()) {
		hyphencase = '-' + hyphencase;
	}
	return hyphencase;
}

/** Strips the last extension, as `@vue/compiler-core` does to derive a component's self-reference name. */
export function getBaseNameWithoutExtension(fileName: string) {
	const baseName = path.basename(fileName);
	return baseName.slice(0, baseName.lastIndexOf('.'));
}

/** The name a Vue file's template refers to the file's own component by. */
export function getSelfComponentName(fileName: string) {
	return capitalize(camelize(getBaseNameWithoutExtension(fileName)));
}
