import { hyphenate } from '@vue/shared';
import { LanguageServiceRuntimeContext, VirtualFile } from '@volar/language-service';
import { checkComponentNames, getTemplateTagsAndAttrs, checkPropsOfTag } from '../helpers';
import * as vue from '@volar/vue-language-core';
import * as vscode from 'vscode-languageserver-protocol';
import { AttrNameCasing, TagNameCasing } from '../types';

export async function convertTagName(
	context: LanguageServiceRuntimeContext,
	uri: string,
	casing: TagNameCasing,
) {

	const vueDocument = context.documents.get(uri);
	if (!vueDocument)
		return;

	if (!(vueDocument.rootFile instanceof vue.VueFile))
		return;

	const desc = vueDocument.rootFile.sfc;
	if (!desc.template)
		return;

	const template = desc.template;
	const document = vueDocument.document;
	const edits: vscode.TextEdit[] = [];
	const components = checkComponentNames(context.host.getTypeScriptModule(), context.typescriptLanguageService, vueDocument.rootFile);
	const tags = getTemplateTagsAndAttrs(vueDocument.rootFile);

	for (const [tagName, { offsets }] of tags) {
		const componentName = components.find(component => component === tagName || hyphenate(component) === tagName);
		if (componentName) {
			for (const offset of offsets) {
				const start = document.positionAt(template.startTagEnd + offset);
				const end = document.positionAt(template.startTagEnd + offset + tagName.length);
				const range = vscode.Range.create(start, end);
				if (casing === TagNameCasing.Kebab && tagName !== hyphenate(componentName)) {
					edits.push(vscode.TextEdit.replace(range, hyphenate(componentName)));
				}
				if (casing === TagNameCasing.Pascal && tagName !== componentName) {
					edits.push(vscode.TextEdit.replace(range, componentName));
				}
			}
		}
	}

	return edits;
}

export async function convertAttrName(
	context: LanguageServiceRuntimeContext,
	uri: string,
	casing: AttrNameCasing,
) {

	const vueDocument = context.documents.get(uri);
	if (!vueDocument)
		return;

	if (!(vueDocument.rootFile instanceof vue.VueFile))
		return;

	const desc = vueDocument.rootFile.sfc;
	if (!desc.template)
		return;

	const template = desc.template;
	const document = vueDocument.document;
	const edits: vscode.TextEdit[] = [];
	const components = checkComponentNames(context.host.getTypeScriptModule(), context.typescriptLanguageService, vueDocument.rootFile);
	const tags = getTemplateTagsAndAttrs(vueDocument.rootFile);

	for (const [tagName, { attrs }] of tags) {
		const componentName = components.find(component => component === tagName || hyphenate(component) === tagName);
		if (componentName) {
			const props = checkPropsOfTag(context.host.getTypeScriptModule(), context.typescriptLanguageService, vueDocument.rootFile, componentName);
			for (const [attrName, { offsets }] of attrs) {
				const propName = props.find(prop => prop === attrName || hyphenate(prop) === attrName);
				if (propName) {
					for (const offset of offsets) {
						const start = document.positionAt(template.startTagEnd + offset);
						const end = document.positionAt(template.startTagEnd + offset + attrName.length);
						const range = vscode.Range.create(start, end);
						if (casing === AttrNameCasing.Kebab && attrName !== hyphenate(propName)) {
							edits.push(vscode.TextEdit.replace(range, hyphenate(propName)));
						}
						if (casing === AttrNameCasing.Camel && attrName !== propName) {
							edits.push(vscode.TextEdit.replace(range, propName));
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
	tag: TagNameCasing[],
	attr: AttrNameCasing[],
} {

	const vueDocument = context.documents.get(uri);
	if (!vueDocument) return {
		tag: [],
		attr: [],
	};

	return {
		tag: getTagNameCase(vueDocument.rootFile),
		attr: getAttrNameCase(vueDocument.rootFile),
	};

	function getAttrNameCase(file: VirtualFile): AttrNameCasing[] {

		const tags = getTemplateTagsAndAttrs(file);
		const result: AttrNameCasing[] = [];

		for (const [_, { attrs }] of tags) {
			for (const [tagName] of attrs) {
				// attrName
				if (tagName !== hyphenate(tagName)) {
					result.push(AttrNameCasing.Camel);
					break;
				}
			}
			for (const [tagName] of attrs) {
				// attr-name
				if (tagName.indexOf('-') >= 0) {
					result.push(AttrNameCasing.Kebab);
					break;
				}
			}
		}

		return result;
	}
	function getTagNameCase(file: VirtualFile): TagNameCasing[] {

		const components = checkComponentNames(context.host.getTypeScriptModule(), context.typescriptLanguageService, file);
		const tagNames = getTemplateTagsAndAttrs(file);
		const result: TagNameCasing[] = [];

		let anyComponentUsed = false;

		for (const component of components) {
			if (tagNames.has(component) || tagNames.has(hyphenate(component))) {
				anyComponentUsed = true;
				break;
			}
		}
		if (!anyComponentUsed) {
			return []; // not sure component style, because do not have any component using in <template> for check
		}

		for (const [tagName] of tagNames) {
			// TagName
			if (tagName !== hyphenate(tagName)) {
				result.push(TagNameCasing.Pascal);
				break;
			}
		}
		for (const component of components) {
			// Tagname -> tagname
			// TagName -> tag-name
			if (component !== hyphenate(component) && tagNames.has(hyphenate(component))) {
				result.push(TagNameCasing.Kebab);
				break;
			}
		}

		return result;
	}
}
