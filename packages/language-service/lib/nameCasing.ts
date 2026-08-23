import type { LanguageServiceContext } from '@volar/language-service';
import type { NodeTypes } from '@vue/compiler-dom';
import type * as CompilerDOM from '@vue/compiler-dom';
import { forEachElementNode, hyphenateTag, VueVirtualCode } from '@vue/language-core';
import { computedSet } from '@vue/language-core/lib/utils/signals';
import type { URI } from 'vscode-uri';

const nameCasingGraphs = new WeakMap<VueVirtualCode, {
	tag: () => Set<TagNameCasing>;
	attr: () => Set<AttrNameCasing>;
}>();

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
		const detectedCasings = getNameCasingGraph(root).tag();
		if (detectedCasings.size === 1) {
			return detectedCasings.values().next().value!;
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
		const detectedCasings = getNameCasingGraph(root).attr();
		if (detectedCasings.size === 1) {
			return detectedCasings.values().next().value!;
		}
	}
	if (config === 'preferKebabCase') {
		return AttrNameCasing.Kebab;
	}

	return AttrNameCasing.Camel;
}

function getNameCasingGraph(code: VueVirtualCode) {
	let graph = nameCasingGraphs.get(code);
	if (!graph) {
		nameCasingGraphs.set(
			code,
			graph = {
				tag: computedSet(() => detectTagCasing(code.ir.template?.ast)),
				attr: computedSet(() => detectAttrCasing(code.ir.template?.ast)),
			},
		);
	}
	return graph;
}

function detectAttrCasing(ast: CompilerDOM.RootNode | undefined) {
	const result = new Set<AttrNameCasing>();
	if (!ast) {
		return result;
	}

	for (const node of forEachElementNode(ast)) {
		for (const prop of node.props) {
			let name: string;
			if (
				prop.type === 7 satisfies NodeTypes.DIRECTIVE
				&& prop.arg?.type === 4 satisfies NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.isStatic
			) {
				name = prop.arg.content;
			}
			else if (prop.type === 6 satisfies NodeTypes.ATTRIBUTE) {
				name = prop.name;
			}
			else {
				continue;
			}
			if (name !== hyphenateTag(name)) {
				result.add(AttrNameCasing.Camel);
			}
			if (name.includes('-')) {
				result.add(AttrNameCasing.Kebab);
			}
		}
	}
	return result;
}

function detectTagCasing(ast: CompilerDOM.RootNode | undefined) {
	const result = new Set<TagNameCasing>();
	if (!ast) {
		return result;
	}

	for (const { tag, tagType } of forEachElementNode(ast)) {
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
	return result;
}
