import type { TsApiRegisterOptions } from '../types';
import { hyphenate } from '@vue/shared';

export function register({ sourceFiles }: TsApiRegisterOptions) {
	return (uri: string): 'both' | 'kebabCase' | 'pascalCase' | 'unsure' => {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return 'unsure';

		const components = sourceFile.getTemplateScriptData().components;
		const usedTags = sourceFile.getUsedTags() ?? new Set();

		let anyComponentUsed = false;
		for (const component of components) {
			if (usedTags.has(component) || usedTags.has(hyphenate(component))) {
				anyComponentUsed = true;
				break;
			}
		}
		if (!anyComponentUsed) {
			return 'unsure'; // not sure component style, because do not have any componnent using in <template> for check
		}

		let hasPascalCase = false;
		let hasKebabCase = false;

		for (const tagName of usedTags) {
			if (tagName !== hyphenate(tagName)) {
				hasPascalCase = true;
				break;
			}
		}
		for (const component of components) {
			if (component !== hyphenate(component) && usedTags.has(hyphenate(component))) {
				hasKebabCase = true;
				break;
			}
		}

		if (hasPascalCase && hasKebabCase) {
			return 'both';
		}
		if (hasPascalCase) {
			return 'pascalCase';
		}
		if (hasKebabCase) {
			return 'kebabCase';
		}
		return 'unsure';
	}
}
