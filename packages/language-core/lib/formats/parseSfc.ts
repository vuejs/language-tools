import * as CompilerDOM from '@vue/compiler-dom';
import { normalizeAttributeValue } from '../template/elements';
import type { IRAttr, VueFormatBlock, VueFormatResult } from '../types';

/** Reads the blocks of a Vue SFC. */
export function parse(source: string): VueFormatResult {
	const errors: CompilerDOM.CompilerError[] = [];
	const ast = CompilerDOM.parse(source, {
		// there are no components at SFC parsing level
		isNativeTag: () => true,
		// preserve all whitespaces
		isPreTag: () => true,
		parseMode: 'sfc',
		onError: e => {
			errors.push(e);
		},
		comments: true,
	});
	const result: VueFormatResult = {
		comments: [],
		errors,
		template: undefined,
		script: undefined,
		scriptSetup: undefined,
		styles: [],
		customBlocks: [],
	};
	for (const node of ast.children) {
		if (node.type === CompilerDOM.NodeTypes.COMMENT) {
			result.comments.push(node.content);
			continue;
		}
		else if (node.type !== CompilerDOM.NodeTypes.ELEMENT) {
			continue;
		}
		const block = createBlock(node, source);
		const attrs = new Map(
			node.props
				.filter(prop => prop.type === CompilerDOM.NodeTypes.ATTRIBUTE)
				.map(prop => [prop.name, prop]),
		);
		switch (node.tag) {
			case 'template':
				result.template = block;
				break;
			case 'script': {
				const setup = attrs.has('setup') || attrs.has('vapor');
				if (setup && !result.scriptSetup) {
					const generic = attrs.get('generic');
					result.scriptSetup = {
						...block,
						generic: generic ? parseAttr(generic) : attrs.has('vapor') || undefined,
					};
				}
				else if (!setup && !result.script) {
					const src = attrs.get('src');
					result.script = { ...block, src: src && parseAttr(src) };
				}
				break;
			}
			case 'style': {
				const src = attrs.get('src');
				const module = attrs.get('module');
				const moduleName = module && parseAttr(module);
				result.styles.push({
					...block,
					src: src && parseAttr(src),
					// an empty name means the default `$style`, anchored to the attribute name
					module: module && (moduleName !== true && moduleName?.text
						? moduleName
						: { text: '', offset: module.loc.start.offset }),
					scoped: attrs.has('scoped'),
				});
				break;
			}
			default:
				result.customBlocks.push({ ...block, type: node.tag });
				break;
		}
	}
	return result;
}

const defaultLangs: Record<string, string> = {
	template: 'html',
	script: 'js',
	style: 'css',
};

function createBlock(node: CompilerDOM.ElementNode, source: string): VueFormatBlock {
	let contentStart: number;
	let contentEnd: number;
	if (node.children.length) {
		contentStart = node.children[0]!.loc.start.offset;
		contentEnd = node.children[node.children.length - 1]!.loc.end.offset;
	}
	else {
		const offset = node.loc.source.indexOf(`</`);
		contentStart = contentEnd = offset > -1 ? node.loc.start.offset + offset : node.loc.end.offset;
	}
	const attrs: Record<string, string | true> = {};
	let lang: string | undefined;
	for (const prop of node.props) {
		if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			attrs[prop.name] = prop.value ? prop.value.content || true : true;
			if (prop.name === 'lang') {
				lang = prop.value?.content;
			}
		}
	}
	return {
		content: source.slice(contentStart, contentEnd),
		offset: contentStart,
		lang: lang ?? defaultLangs[node.tag] ?? 'txt',
		attrs,
		element: { start: node.loc.start.offset, end: node.loc.end.offset },
	};
}

function parseAttr(prop: CompilerDOM.AttributeNode): IRAttr {
	if (!prop.value) {
		return true;
	}
	const [text, offset] = normalizeAttributeValue(prop.value);
	return { text, offset };
}
