import type { TsApiRegisterOptions } from '../types';
import { hyphenate } from '@vue/shared';

export function register({ sourceFiles }: TsApiRegisterOptions) {
	return (uri: string): 'both' | 'kebabCase' | 'pascalCase' => {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return 'both';

		const usedTags = sourceFile.getUsedTags() ?? new Set();
		for (const tagName of usedTags) {
			if (tagName !== hyphenate(tagName)) {
				return 'pascalCase';
			}
		}

		return 'kebabCase';
	}
}
