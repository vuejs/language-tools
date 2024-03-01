import type { ServiceContext, VirtualCode } from '@volar/language-service';
import type { CompilerDOM } from '@vue/language-core';
import * as vue from '@vue/language-core';
import { VueGeneratedCode, hyphenateAttr, hyphenateTag } from '@vue/language-core';
import * as namedPipeClient from '@vue/typescript-plugin/lib/client';
import { computed } from 'computeds';
import type * as vscode from 'vscode-languageserver-protocol';
import { AttrNameCasing, TagNameCasing } from '../types';

export async function convertTagName(context: ServiceContext, uri: string, casing: TagNameCasing) {

	const sourceFile = context.language.files.get(uri);
	if (!sourceFile)
		return;

	const rootCode = sourceFile?.generated?.code;
	if (!(rootCode instanceof VueGeneratedCode))
		return;

	const desc = rootCode.sfc;
	if (!desc.template)
		return;

	const template = desc.template;
	const document = context.documents.get(sourceFile.id, sourceFile.languageId, sourceFile.snapshot);
	const edits: vscode.TextEdit[] = [];
	const components = await namedPipeClient.getComponentNames(rootCode.fileName) ?? [];
	const tags = getTemplateTagsAndAttrs(rootCode);

	for (const [tagName, { offsets }] of tags) {
		const componentName = components.find(component => component === tagName || hyphenateTag(component) === tagName);
		if (componentName) {
			for (const offset of offsets) {
				const start = document.positionAt(template.startTagEnd + offset);
				const end = document.positionAt(template.startTagEnd + offset + tagName.length);
				const range: vscode.Range = { start, end };
				if (casing === TagNameCasing.Kebab && tagName !== hyphenateTag(componentName)) {
					edits.push({ range, newText: hyphenateTag(componentName) });
				}
				if (casing === TagNameCasing.Pascal && tagName !== componentName) {
					edits.push({ range, newText: componentName });
				}
			}
		}
	}

	return edits;
}

export async function convertAttrName(context: ServiceContext, uri: string, casing: AttrNameCasing) {

	const sourceFile = context.language.files.get(uri);
	if (!sourceFile)
		return;

	const rootCode = sourceFile?.generated?.code;
	if (!(rootCode instanceof VueGeneratedCode))
		return;

	const desc = rootCode.sfc;
	if (!desc.template)
		return;

	const template = desc.template;
	const document = context.documents.get(uri, sourceFile.languageId, sourceFile.snapshot);
	const edits: vscode.TextEdit[] = [];
	const components = await namedPipeClient.getComponentNames(rootCode.fileName) ?? [];
	const tags = getTemplateTagsAndAttrs(rootCode);

	for (const [tagName, { attrs }] of tags) {
		const componentName = components.find(component => component === tagName || hyphenateTag(component) === tagName);
		if (componentName) {
			const props = await namedPipeClient.getComponentProps(rootCode.fileName, componentName) ?? [];
			for (const [attrName, { offsets }] of attrs) {
				const propName = props.find(prop => prop === attrName || hyphenateAttr(prop) === attrName);
				if (propName) {
					for (const offset of offsets) {
						const start = document.positionAt(template.startTagEnd + offset);
						const end = document.positionAt(template.startTagEnd + offset + attrName.length);
						const range: vscode.Range = { start, end };
						if (casing === AttrNameCasing.Kebab && attrName !== hyphenateAttr(propName)) {
							edits.push({ range, newText: hyphenateAttr(propName) });
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

export async function getNameCasing(context: ServiceContext, uri: string) {

	const detected = await detect(context, uri);
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

export async function detect(context: ServiceContext, uri: string): Promise<{
	tag: TagNameCasing[],
	attr: AttrNameCasing[],
}> {

	const rootFile = context.language.files.get(uri)?.generated?.code;
	if (!(rootFile instanceof VueGeneratedCode)) {
		return {
			tag: [],
			attr: [],
		};
	}

	return {
		tag: await getTagNameCase(rootFile),
		attr: getAttrNameCase(rootFile),
	};

	function getAttrNameCase(file: VirtualCode): AttrNameCasing[] {

		const tags = getTemplateTagsAndAttrs(file);
		const result: AttrNameCasing[] = [];

		for (const [_, { attrs }] of tags) {
			for (const [tagName] of attrs) {
				// attrName
				if (tagName !== hyphenateTag(tagName)) {
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
	async function getTagNameCase(file: VueGeneratedCode): Promise<TagNameCasing[]> {

		const components = await namedPipeClient.getComponentNames(file.fileName) ?? [];
		const tagNames = getTemplateTagsAndAttrs(file);
		const result: TagNameCasing[] = [];

		let anyComponentUsed = false;

		for (const component of components) {
			if (tagNames.has(component) || tagNames.has(hyphenateTag(component))) {
				anyComponentUsed = true;
				break;
			}
		}
		if (!anyComponentUsed) {
			return []; // not sure component style, because do not have any component using in <template> for check
		}

		for (const [tagName] of tagNames) {
			// TagName
			if (tagName !== hyphenateTag(tagName)) {
				result.push(TagNameCasing.Pascal);
				break;
			}
		}
		for (const component of components) {
			// Tagname -> tagname
			// TagName -> tag-name
			if (component !== hyphenateTag(component) && tagNames.has(hyphenateTag(component))) {
				result.push(TagNameCasing.Kebab);
				break;
			}
		}

		return result;
	}
}

type Tags = Map<string, {
	offsets: number[];
	attrs: Map<string, {
		offsets: number[];
	}>,
}>;

const map = new WeakMap<VirtualCode, () => Tags | undefined>();

function getTemplateTagsAndAttrs(sourceFile: VirtualCode): Tags {

	if (!map.has(sourceFile)) {
		const getter = computed(() => {
			if (!(sourceFile instanceof vue.VueGeneratedCode))
				return;
			const ast = sourceFile.sfc.template?.ast;
			const tags: Tags = new Map();
			if (ast) {
				for (const node of vue.eachElementNode(ast)) {

					if (!tags.has(node.tag)) {
						tags.set(node.tag, { offsets: [], attrs: new Map() });
					}

					const tag = tags.get(node.tag)!;
					const startTagHtmlOffset = node.loc.start.offset + node.loc.source.indexOf(node.tag);
					const endTagHtmlOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);

					tag.offsets.push(startTagHtmlOffset);
					if (!node.isSelfClosing) {
						tag.offsets.push(endTagHtmlOffset);
					}

					for (const prop of node.props) {

						let name: string | undefined;
						let offset: number | undefined;

						if (
							prop.type === 7 satisfies CompilerDOM.NodeTypes.DIRECTIVE
							&& prop.arg?.type === 4 satisfies CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
							&& prop.arg.isStatic
						) {
							name = prop.arg.content;
							offset = prop.arg.loc.start.offset;
						}
						else if (
							prop.type === 6 satisfies CompilerDOM.NodeTypes.ATTRIBUTE
						) {
							name = prop.name;
							offset = prop.loc.start.offset;
						}

						if (name !== undefined && offset !== undefined) {
							if (!tag.attrs.has(name)) {
								tag.attrs.set(name, { offsets: [] });
							}
							tag.attrs.get(name)!.offsets.push(offset);
						}
					}
				}
			}
			return tags;
		});
		map.set(sourceFile, getter);
	}

	return map.get(sourceFile)!() ?? new Map();
}
