import type { LanguageServiceContext, VirtualCode } from '@volar/language-service';
import type { NodeTypes } from '@vue/compiler-dom';
import type * as CompilerDOM from '@vue/compiler-dom';
import { forEachElementNode, hyphenateTag, VueVirtualCode } from '@vue/language-core';
import type { URI } from 'vscode-uri';

type CollectResult = Map<string, [tagType: CompilerDOM.ElementTypes, attrs: string[]]>;

const collectCache = new WeakMap<VirtualCode, CollectResult>();

export const enum TagNameCasing {
	Kebab,
	Pascal,
}

export const enum AttrNameCasing {
	Kebab,
	Camel,
}

export async function getTagNameCasing(context: LanguageServiceContext, uri: URI) {
	const config = await context.env.getConfiguration<
		'preferKebabCase' | 'preferPascalCase' | 'alwaysKebabCase' | 'alwaysPascalCase'
	>?.('vue.suggest.componentNameCasing', uri.toString());

	if (config === 'alwaysKebabCase') {
		return TagNameCasing.Kebab;
	}
	if (config === 'alwaysPascalCase') {
		return TagNameCasing.Pascal;
	}

	const root = context.language.scripts.get(uri)?.generated?.root;

	if (root instanceof VueVirtualCode) {
		const detectedCasings = detectTagCasing(root);
		if (detectedCasings.length === 1) {
			return detectedCasings[0];
		}
	}
	if (config === 'preferKebabCase') {
		return TagNameCasing.Kebab;
	}

	return TagNameCasing.Pascal;
}

export async function getAttrNameCasing(context: LanguageServiceContext, uri: URI) {
	const config = await context.env.getConfiguration<
		'preferKebabCase' | 'preferCamelCase' | 'alwaysKebabCase' | 'alwaysCamelCase'
	>?.('vue.suggest.propNameCasing', uri.toString());

	if (config === 'alwaysKebabCase') {
		return AttrNameCasing.Kebab;
	}
	if (config === 'alwaysCamelCase') {
		return AttrNameCasing.Camel;
	}

	const root = context.language.scripts.get(uri)?.generated?.root;

	if (root instanceof VueVirtualCode) {
		const detectedCasings = detectAttrCasing(root);
		if (detectedCasings.length === 1) {
			return detectedCasings[0];
		}
	}
	if (config === 'preferKebabCase') {
		return AttrNameCasing.Kebab;
	}

	return AttrNameCasing.Camel;
}

function detectAttrCasing(code: VueVirtualCode) {
	const tags = collectTagsWithCache(code);
	const result = new Set<AttrNameCasing>();

	for (const [, [_, attrs]] of tags) {
		for (const attr of attrs) {
			if (attr !== hyphenateTag(attr)) {
				result.add(AttrNameCasing.Camel);
				break;
			}
		}
		for (const attr of attrs) {
			if (attr.includes('-')) {
				result.add(AttrNameCasing.Kebab);
				break;
			}
		}
	}
	return [...result];
}

function detectTagCasing(code: VueVirtualCode): TagNameCasing[] {
	const tags = collectTagsWithCache(code);
	const result = new Set<TagNameCasing>();

	for (const [tag, [tagType]] of tags) {
		if (
			tagType === 0 satisfies CompilerDOM.ElementTypes.ELEMENT
			|| tagType === 3 satisfies CompilerDOM.ElementTypes.TEMPLATE
		) {
			continue;
		}
		if (tag !== hyphenateTag(tag)) {
			result.add(TagNameCasing.Pascal);
		}
		else {
			result.add(TagNameCasing.Kebab);
		}
	}
	return [...result];
}

function collectTagsWithCache(code: VueVirtualCode) {
	let cache = collectCache.get(code);
	if (!cache) {
		const ast = code.sfc.template?.ast;
		cache = ast ? collectTags(ast) : new Map();
		collectCache.set(code, cache);
	}
	return cache;
}

function collectTags(ast: CompilerDOM.RootNode) {
	const tags: CollectResult = new Map();

	for (const node of forEachElementNode(ast)) {
		let tag = tags.get(node.tag);
		if (!tag) {
			tags.set(node.tag, tag = [node.tagType, []]);
		}
		for (const prop of node.props) {
			let name: string | undefined;
			if (
				prop.type === 7 satisfies NodeTypes.DIRECTIVE
				&& prop.arg?.type === 4 satisfies NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.isStatic
			) {
				name = prop.arg.content;
			}
			else if (
				prop.type === 6 satisfies NodeTypes.ATTRIBUTE
			) {
				name = prop.name;
			}
			if (name !== undefined) {
				tag[1].push(name);
			}
		}
	}

	return tags;
}
