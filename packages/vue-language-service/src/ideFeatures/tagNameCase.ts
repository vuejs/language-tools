import type { LanguageServiceRuntimeContext } from '../types';
import { hyphenate } from '@vue/shared';
import { SourceFileDocument } from '../documents';
import { checkTemplateData, getTemplateTagsAndAttrs } from '../helpers';

export function register(context: LanguageServiceRuntimeContext) {
	return async (uri: string): Promise<{
		tag: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
		attr: 'kebabCase' | 'camelCase' | 'unsure',
	}> => {

		const vueDocument = context.documents.get(uri);
		if (!vueDocument) return {
			tag: 'unsure',
			attr: 'unsure',
		};

		return {
			tag: await getTagNameCase(vueDocument),
			attr: getAttrNameCase(vueDocument),
		};

		function getAttrNameCase(sourceFile: SourceFileDocument): 'kebabCase' | 'camelCase' | 'unsure' {

			const attrNames = getTemplateTagsAndAttrs(sourceFile.file).attrs;

			let hasCamelCase = false;
			let hasKebabCase = false;

			for (const tagName of attrNames) {
				// attrName
				if (tagName !== hyphenate(tagName)) {
					hasCamelCase = true;
					break;
				}
			}
			for (const tagName of attrNames) {
				// attr-name
				if (tagName.indexOf('-') >= 0) {
					hasKebabCase = true;
					break;
				}
			}

			if (hasCamelCase && hasKebabCase) {
				return 'kebabCase';
			}
			if (hasCamelCase) {
				return 'camelCase';
			}
			if (hasKebabCase) {
				return 'kebabCase';
			}
			return 'unsure';
		}
		async function getTagNameCase(vueDocument: SourceFileDocument): Promise<'both' | 'kebabCase' | 'pascalCase' | 'unsure'> {

			const components = checkTemplateData(vueDocument.file, context.typescriptLanguageService).components;
			const tagNames = getTemplateTagsAndAttrs(vueDocument.file).tags;

			let anyComponentUsed = false;
			let hasPascalCase = false;
			let hasKebabCase = false;

			for (const component of components) {
				if (tagNames.has(component) || tagNames.has(hyphenate(component))) {
					anyComponentUsed = true;
					break;
				}
			}
			if (!anyComponentUsed) {
				return 'unsure'; // not sure component style, because do not have any component using in <template> for check
			}
			for (const [tagName] of tagNames) {
				// TagName
				if (tagName !== hyphenate(tagName)) {
					hasPascalCase = true;
					break;
				}
			}
			for (const component of components) {
				// Tagname -> tagname
				// TagName -> tag-name
				if (component !== hyphenate(component) && tagNames.has(hyphenate(component))) {
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
	};
}
