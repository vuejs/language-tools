import type { ElementNode, SourceLocation } from '@vue/compiler-dom';
import * as CompilerDOM from '@vue/compiler-dom';
import type { CompilerError, SFCBlock, SFCDescriptor, SFCParseResult, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';

declare module '@vue/compiler-sfc' {
	interface SFCDescriptor {
		comments: string[];
	}
}

export function parse(source: string): SFCParseResult {

	const errors: CompilerError[] = [];
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
	const descriptor: SFCDescriptor = {
		filename: 'anonymous.vue',
		source,
		comments: [],
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
		cssVars: [],
		slotted: false,
		shouldForceReload: () => false,
	};
	ast.children.forEach(node => {
		if (node.type === CompilerDOM.NodeTypes.COMMENT) {
			descriptor.comments.push(node.content);
			return;
		}
		else if (node.type !== CompilerDOM.NodeTypes.ELEMENT) {
			return;
		}
		switch (node.tag) {
			case 'template':
				descriptor.template = createBlock(node, source) as SFCTemplateBlock;
				break;
			case 'script':
				const scriptBlock = createBlock(node, source) as SFCScriptBlock;
				const isSetup = !!scriptBlock.setup;
				if (isSetup && !descriptor.scriptSetup) {
					descriptor.scriptSetup = scriptBlock;
					break;
				}
				if (!isSetup && !descriptor.script) {
					descriptor.script = scriptBlock;
					break;
				}
				break;
			case 'style':
				const styleBlock = createBlock(node, source) as SFCStyleBlock;
				descriptor.styles.push(styleBlock);
				break;
			default:
				descriptor.customBlocks.push(createBlock(node, source));
				break;
		}
	});

	return {
		descriptor,
		errors,
	};
}

function createBlock(node: ElementNode, source: string) {
	const type = node.tag;
	let { start, end } = node.loc;
	let content = '';
	if (node.children.length) {
		start = node.children[0].loc.start;
		end = node.children[node.children.length - 1].loc.end;
		content = source.slice(start.offset, end.offset);
	}
	else {
		const offset = node.loc.source.indexOf(`</`);
		if (offset > -1) {
			start = {
				line: start.line,
				column: start.column + offset,
				offset: start.offset + offset
			};
		}
		end = Object.assign({}, start);
	}
	const loc: SourceLocation = {
		source: content,
		start,
		end
	};
	const attrs: Record<string, any> = {};
	const block: SFCBlock = {
		type,
		content,
		loc,
		attrs
	};
	node.props.forEach(p => {
		if (p.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			attrs[p.name] = p.value ? p.value.content || true : true;
			if (p.name === 'lang') {
				block.lang = p.value?.content;
			}
			else if (p.name === 'src') {
				block.__src = parseAttr(p, node);
			}
			else if (isScriptBlock(block)) {
				if (p.name === 'setup' || p.name === 'vapor') {
					block.setup = attrs[p.name];
				}
				else if (p.name === 'generic') {
					block.__generic = parseAttr(p, node);
				}
			}
			else if (isStyleBlock(block)) {
				if (p.name === 'scoped') {
					block.scoped = true;
				}
				else if (p.name === 'module') {
					block.__module = parseAttr(p, node);
				}
			}
		}
	});
	return block;
}

function isScriptBlock(block: SFCBlock): block is SFCScriptBlock {
	return block.type === 'script';
}

function isStyleBlock(block: SFCBlock): block is SFCStyleBlock {
	return block.type === 'style';
}

function parseAttr(p: CompilerDOM.AttributeNode, node: CompilerDOM.ElementNode) {
	if (!p.value) {
		return true;
	}
	const text = p.value.content;
	const source = p.value.loc.source;
	let offset = p.value.loc.start.offset - node.loc.start.offset;
	const quotes = source.startsWith('"') || source.startsWith("'");
	if (quotes) {
		offset++;
	}
	return {
		text,
		offset,
		quotes,
	};
}
