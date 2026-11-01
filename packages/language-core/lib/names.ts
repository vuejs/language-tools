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

/**
 * The keys that a registry of directives or components is searched by for the `name` that a template uses, in order,
 * like `resolveAsset` of `@vue/runtime-core` searches them.
 */
export function getAssetKeys(name: string) {
	return [...new Set([name, camelize(name), capitalize(camelize(name))])];
}

/** A name that a template can use the registry key `key` by: its hyphenated form if `getAssetKeys` resolves it. */
export function getAssetName(key: string) {
	const name = hyphenate(key);
	return getAssetKeys(name).includes(key) ? name : key;
}

/** The name a Vue file's template refers to the file's own component by. */
export function getSelfComponentName(fileName: string) {
	return capitalize(camelize(getBaseNameWithoutExtension(fileName)));
}
