import { hyphenate } from '@vue/shared';
import { SourceFileDocument, LanguageServiceRuntimeContext } from '@volar/language-service';
import { checkComponentNames, getTemplateTagsAndAttrs } from '../helpers';
import * as vue from '@volar/vue-language-core';
import * as vscode from 'vscode-languageserver-protocol';

export async function convert(
	context: LanguageServiceRuntimeContext,
	findReferences: (uri: string, position: vscode.Position) => Promise<vscode.Location[] | undefined>,
	uri: string,
	mode: 'kebab' | 'pascal',
) {

	const vueDocument = context.documents.get(uri);
	if (!vueDocument)
		return;

	if (!(vueDocument.file instanceof vue.VueSourceFile))
		return;

	const desc = vueDocument.file.sfc;
	if (!desc.template)
		return;

	const template = desc.template;
	const document = vueDocument.getDocument();
	const edits: vscode.TextEdit[] = [];
	const components = new Set(checkComponentNames(context.host.getTypeScriptModule(), context.typescriptLanguageService, vueDocument.file));
	const tagOffsets = getTemplateTagsAndAttrs(vueDocument.file).tags;

	for (const [_, offsets] of tagOffsets) {
		if (offsets.length) {

			const offset = template.startTagEnd + offsets[0];
			const refs = await findReferences(uri, vueDocument.getDocument().positionAt(offset)) ?? [];

			for (const vueLoc of refs) {
				if (
					vueLoc.uri === vueDocument.uri
					&& document.offsetAt(vueLoc.range.start) >= template.startTagEnd
					&& document.offsetAt(vueLoc.range.end) <= template.startTagEnd + template.content.length
				) {
					const referenceText = document.getText(vueLoc.range);
					for (const component of components) {
						if (component === referenceText || hyphenate(component) === referenceText) {
							if (mode === 'kebab' && referenceText !== hyphenate(component)) {
								edits.push(vscode.TextEdit.replace(vueLoc.range, hyphenate(component)));
							}
							if (mode === 'pascal' && referenceText !== component) {
								edits.push(vscode.TextEdit.replace(vueLoc.range, component));
							}
						}
					}
				}
			}
		}
	}

	return edits;
}

export function detect(
	context: LanguageServiceRuntimeContext,
	uri: string,
): {
	tag: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
	attr: 'kebabCase' | 'camelCase' | 'unsure',
} {

	const vueDocument = context.documents.get(uri);
	if (!vueDocument) return {
		tag: 'unsure',
		attr: 'unsure',
	};

	return {
		tag: getTagNameCase(vueDocument),
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
	function getTagNameCase(vueDocument: SourceFileDocument): 'both' | 'kebabCase' | 'pascalCase' | 'unsure' {

		const components = checkComponentNames(context.host.getTypeScriptModule(), context.typescriptLanguageService, vueDocument.file);
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
}
