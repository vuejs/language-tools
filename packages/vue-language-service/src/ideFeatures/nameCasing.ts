import { hyphenate } from '@vue/shared';
import { ServiceContext, VirtualFile } from '@volar/language-service';
import { getComponentNames, getTemplateTagsAndAttrs, getPropsByTag } from '../helpers';
import * as vue from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';
import { AttrNameCasing, TagNameCasing } from '../types';
import type { Provide } from 'volar-service-typescript';

export async function convertTagName(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	context: ServiceContext<Provide>,
	uri: string,
	casing: TagNameCasing,
	vueCompilerOptions: vue.VueCompilerOptions,
) {

	const rootFile = context.documents.getSourceByUri(uri)?.root;
	if (!(rootFile instanceof vue.VueFile))
		return;

	const desc = rootFile.sfc;
	if (!desc.template)
		return;

	const languageService = context.inject('typescript/languageService');
	const template = desc.template;
	const document = context.documents.getDocumentByFileName(rootFile.snapshot, rootFile.fileName);
	const edits: vscode.TextEdit[] = [];
	const components = getComponentNames(ts, languageService, rootFile, vueCompilerOptions);
	const tags = getTemplateTagsAndAttrs(rootFile);

	for (const [tagName, { offsets }] of tags) {
		const componentName = components.find(component => component === tagName || hyphenate(component) === tagName);
		if (componentName) {
			for (const offset of offsets) {
				const start = document.positionAt(template.startTagEnd + offset);
				const end = document.positionAt(template.startTagEnd + offset + tagName.length);
				const range: vscode.Range = { start, end };
				if (casing === TagNameCasing.Kebab && tagName !== hyphenate(componentName)) {
					edits.push({ range, newText: hyphenate(componentName) });
				}
				if (casing === TagNameCasing.Pascal && tagName !== componentName) {
					edits.push({ range, newText: componentName });
				}
			}
		}
	}

	return edits;
}

export async function convertAttrName(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	context: ServiceContext,
	uri: string,
	casing: AttrNameCasing,
	vueCompilerOptions: vue.VueCompilerOptions,
) {

	const rootFile = context.documents.getSourceByUri(uri)?.root;
	if (!(rootFile instanceof vue.VueFile))
		return;

	const desc = rootFile.sfc;
	if (!desc.template)
		return;

	const languageService = context.inject('typescript/languageService');
	const template = desc.template;
	const document = context.documents.getDocumentByFileName(rootFile.snapshot, rootFile.fileName);
	const edits: vscode.TextEdit[] = [];
	const components = getComponentNames(ts, languageService, rootFile, vueCompilerOptions);
	const tags = getTemplateTagsAndAttrs(rootFile);

	for (const [tagName, { attrs }] of tags) {
		const componentName = components.find(component => component === tagName || hyphenate(component) === tagName);
		if (componentName) {
			const props = getPropsByTag(ts, languageService, rootFile, componentName, vueCompilerOptions);
			for (const [attrName, { offsets }] of attrs) {
				const propName = props.find(prop => prop === attrName || hyphenate(prop) === attrName);
				if (propName) {
					for (const offset of offsets) {
						const start = document.positionAt(template.startTagEnd + offset);
						const end = document.positionAt(template.startTagEnd + offset + attrName.length);
						const range: vscode.Range = { start, end };
						if (casing === AttrNameCasing.Kebab && attrName !== hyphenate(propName)) {
							edits.push({ range, newText: hyphenate(propName) });
						}
						if (casing === AttrNameCasing.Camel && attrName !== propName) {
							edits.push({ range, newText: propName });
						}
					}
				}
			}
		}
	}

	return edits;
}

export async function getNameCasing(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	context: ServiceContext,
	uri: string,
	vueCompilerOptions: vue.VueCompilerOptions,
) {

	const detected = detect(ts, context, uri, vueCompilerOptions);
	const [attr, tag] = await Promise.all([
		context.env.getConfiguration?.<'autoKebab' | 'autoCamel' | 'kebab' | 'camel'>('vue.complete.casing.props', uri),
		context.env.getConfiguration?.<'autoKebab' | 'autoPascal' | 'kebab' | 'pascal'>('vue.complete.casing.tags', uri),
	]);
	const tagNameCasing = detected.tag.length === 1 && (tag === 'autoPascal' || tag === 'autoKebab') ? detected.tag[0] : (tag === 'autoKebab' || tag === 'kebab') ? TagNameCasing.Kebab : TagNameCasing.Pascal;
	const attrNameCasing = detected.attr.length === 1 && (attr === 'autoCamel' || attr === 'autoKebab') ? detected.attr[0] : (attr === 'autoCamel' || attr === 'camel') ? AttrNameCasing.Camel : AttrNameCasing.Kebab;

	return {
		tag: tagNameCasing,
		attr: attrNameCasing,
	};
}

export function detect(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	context: ServiceContext,
	uri: string,
	vueCompilerOptions: vue.VueCompilerOptions,
): {
	tag: TagNameCasing[],
	attr: AttrNameCasing[],
} {

	const rootFile = context.documents.getSourceByUri(uri)?.root;
	if (!(rootFile instanceof vue.VueFile)) {
		return {
			tag: [],
			attr: [],
		};
	}

	const languageService = context.inject('typescript/languageService');

	return {
		tag: getTagNameCase(rootFile),
		attr: getAttrNameCase(rootFile),
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

		const components = getComponentNames(ts, languageService, file, vueCompilerOptions);
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
