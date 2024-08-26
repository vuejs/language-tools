import type { CompilerError, SFCDescriptor, SFCBlock, SFCStyleBlock, SFCScriptBlock, SFCTemplateBlock, SFCParseResult } from '@vue/compiler-sfc';
import type { ElementNode, SourceLocation } from '@vue/compiler-dom';
import * as compiler from '@vue/compiler-dom';
import { SFCStyleOverride } from '../types';

export function parse(source: string): SFCParseResult {

	const errors: CompilerError[] = [];
	const ast = compiler.parse(source, {
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
		if (node.type !== compiler.NodeTypes.ELEMENT) {
			return;
		}
		switch (node.tag) {
			case 'template':
				descriptor.template = createBlock(node, source) as SFCTemplateBlock;
				break;
			case 'script':
				const scriptBlock = createBlock(node, source) as SFCScriptBlock;
				const isSetup = !!scriptBlock.attrs.setup;
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
	const block: SFCBlock
		& Pick<SFCStyleBlock, 'scoped'>
		& Pick<SFCStyleOverride, 'module'>
		& Pick<SFCScriptBlock, 'setup'> = {
		type,
		content,
		loc,
		attrs
	};
	node.props.forEach(p => {
		if (p.type === compiler.NodeTypes.ATTRIBUTE) {
			attrs[p.name] = p.value ? p.value.content || true : true;
			if (p.name === 'lang') {
				block.lang = p.value && p.value.content;
			}
			else if (p.name === 'src') {
				block.src = p.value && p.value.content;
			}
			else if (type === 'style') {
				if (p.name === 'scoped') {
					block.scoped = true;
				}
				else if (p.name === 'module') {
					block.module = {
						name: p.value?.content ?? '$style',
						offset: p.value?.content ? p.value?.loc.start.offset - node.loc.start.offset : undefined
					};
				}
			}
			else if (type === 'script' && p.name === 'setup') {
				block.setup = attrs.setup;
			}
		}
	});
	return block;
}
