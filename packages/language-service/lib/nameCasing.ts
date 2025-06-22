import type { LanguageServiceContext, VirtualCode } from '@volar/language-service';
import type { NodeTypes } from '@vue/compiler-dom';
import { forEachElementNode, hyphenateTag, VueVirtualCode } from '@vue/language-core';
import type { URI } from 'vscode-uri';

export enum TagNameCasing {
	Kebab,
	Pascal,
}

export enum AttrNameCasing {
	Kebab,
	Camel,
}

export async function checkCasing(context: LanguageServiceContext, uri: URI) {
	const detected = detect(context, uri);
	const [attr, tag] = await Promise.all([
		context.env.getConfiguration<'autoKebab' | 'autoCamel' | 'kebab' | 'camel'>?.(
			'vue.complete.casing.props',
			uri.toString(),
		),
		context.env.getConfiguration<'autoKebab' | 'autoPascal' | 'kebab' | 'pascal'>?.(
			'vue.complete.casing.tags',
			uri.toString(),
		),
	]);
	const tagNameCasing = detected.tag.length === 1 && (tag === 'autoPascal' || tag === 'autoKebab')
		? detected.tag[0]
		: (tag === 'autoKebab' || tag === 'kebab')
		? TagNameCasing.Kebab
		: TagNameCasing.Pascal;
	const attrNameCasing = detected.attr.length === 1 && (attr === 'autoCamel' || attr === 'autoKebab')
		? detected.attr[0]
		: (attr === 'autoCamel' || attr === 'camel')
		? AttrNameCasing.Camel
		: AttrNameCasing.Kebab;
	return {
		tag: tagNameCasing,
		attr: attrNameCasing,
	};
}

type Tags = Map<string, string[]>;

const cache = new WeakMap<VirtualCode, Tags | undefined>();

function detect(
	context: LanguageServiceContext,
	uri: URI,
): {
	tag: TagNameCasing[];
	attr: AttrNameCasing[];
} {
	const root = context.language.scripts.get(uri)?.generated?.root;
	if (!(root instanceof VueVirtualCode)) {
		return { tag: [], attr: [] };
	}
	return {
		tag: detectTagCasing(root),
		attr: detectAttrCasing(root),
	};
}

function detectAttrCasing(code: VirtualCode) {
	let tags: Tags | undefined;
	if (cache.has(code)) {
		tags = cache.get(code);
	} else {
		cache.set(code, tags = collectTags(code));
	}
	const result = new Set<AttrNameCasing>();

	for (const [, attrs] of tags ?? []) {
		for (const attr of attrs) {
			// attrName
			if (attr !== hyphenateTag(attr)) {
				result.add(AttrNameCasing.Camel);
				break;
			}
		}
		for (const attr of attrs) {
			// attr-name
			if (attr.includes('-')) {
				result.add(AttrNameCasing.Kebab);
				break;
			}
		}
	}
	return [...result];
}

function detectTagCasing(code: VueVirtualCode): TagNameCasing[] {
	let tags: Tags | undefined;
	if (cache.has(code)) {
		tags = cache.get(code);
	} else {
		cache.set(code, tags = collectTags(code));
	}
	const result = new Set<TagNameCasing>();

	for (const [tag] of tags ?? []) {
		if (tag !== hyphenateTag(tag)) {
			// TagName
			result.add(TagNameCasing.Pascal);
		} else {
			// tag-name
			result.add(TagNameCasing.Kebab);
		}
	}
	return [...result];
}

function collectTags(root: VirtualCode) {
	if (!(root instanceof VueVirtualCode)) {
		return undefined;
	}
	const ast = root.sfc.template?.ast;
	if (!ast) {
		return undefined;
	}
	const tags: Tags = new Map();
	for (const node of forEachElementNode(ast)) {
		let tag = tags.get(node.tag);
		if (!tag) {
			tags.set(node.tag, tag = []);
		}
		for (const prop of node.props) {
			let name: string | undefined;
			if (
				prop.type === 7 satisfies NodeTypes.DIRECTIVE
				&& prop.arg?.type === 4 satisfies NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.isStatic
			) {
				name = prop.arg.content;
			} else if (
				prop.type === 6 satisfies NodeTypes.ATTRIBUTE
			) {
				name = prop.name;
			}
			if (name !== undefined) {
				tag.push(name);
			}
		}
	}
	return tags;
}
