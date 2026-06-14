import * as CompilerDOM from '@vue/compiler-dom';
import { normalizeAttributeValue } from '../utils/shared';

export interface RawIR {
	comments: string[];
	templates: RawIRTemplate[];
	scripts: RawIRBlock[];
	styles: RawIRBlock[];
	customBlocks: RawIRBlock[];
}

export interface RawIRBlock {
	name: string;
	start: number;
	end: number;
	innerStart: number;
	innerEnd: number;
	lang?: string;
	content: string;
	attrs: Record<string, RawIRAttr>;
}

export type RawIRAttr = true | {
	text: string;
	offset: number;
};

export interface RawIRTemplate extends RawIRBlock {
	ast?: CompilerDOM.RootNode;
}

export interface RawIRParseResult {
	rawIr: RawIR;
	errors: CompilerDOM.CompilerError[];
	warnings: CompilerDOM.CompilerError[];
}

export function parseRawIR(source: string): RawIRParseResult {
	const errors: CompilerDOM.CompilerError[] = [];
	const warnings: CompilerDOM.CompilerError[] = [];
	const ast = CompilerDOM.parse(source, {
		comments: true,
		parseMode: 'sfc',
		onError: e => {
			errors.push(e);
		},
		onWarn: e => {
			warnings.push(e);
		},
	});

	const rawIr: RawIR = {
		templates: [],
		scripts: [],
		styles: [],
		customBlocks: [],
		comments: [],
	};

	for (const node of ast.children) {
		if (node.type === CompilerDOM.NodeTypes.COMMENT) {
			rawIr.comments.push(node.content);
			continue;
		}
		else if (node.type !== CompilerDOM.NodeTypes.ELEMENT) {
			continue;
		}
		switch (node.tag) {
			case 'template': {
				const block = createBlock(node, source) as RawIRTemplate;
				block.ast = {
					type: CompilerDOM.NodeTypes.ROOT,
					loc: node.loc,
					source: block.content,
					children: node.children,
					helpers: new Set(),
					components: [],
					directives: [],
					hoists: [],
					imports: [],
					cached: [],
					temps: 0,
				};
				rawIr.templates.push(block);
				break;
			}
			case 'script': {
				const block = createBlock(node, source);
				rawIr.scripts.push(block);
				break;
			}
			case 'style': {
				const block = createBlock(node, source);
				rawIr.styles.push(block);
				break;
			}
			default: {
				const block = createBlock(node, source);
				rawIr.customBlocks.push(block);
				break;
			}
		}
	}

	return {
		rawIr,
		errors,
		warnings,
	};
}

function createBlock(node: CompilerDOM.ElementNode, source: string): RawIRBlock {
	let lang: string | undefined;
	for (const prop of node.props) {
		if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === 'lang' && prop.value) {
			lang = prop.value.content;
			break;
		}
	}

	const attrs: Record<string, RawIRAttr> = {};
	for (const prop of node.props) {
		if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			if (prop.value) {
				const [content, offset] = normalizeAttributeValue(prop.value);
				attrs[prop.name] = {
					text: content,
					offset: offset - node.loc.start.offset,
				};
			}
			else {
				attrs[prop.name] = true;
			}
		}
	}

	const innerStart = node.innerLoc!.start.offset;
	let innerEnd = node.innerLoc!.end.offset;

	// Handle 'Element is missing end tag.' error, see #4893
	if (innerStart === innerEnd) {
		const endTagStart = node.loc.source.lastIndexOf('<');
		if (`</${node.tag}>`.startsWith(node.loc.source.slice(endTagStart).trimEnd())) {
			innerEnd = node.loc.start.offset + endTagStart;
		}
		else {
			innerEnd = node.loc.end.offset;
		}
	}

	return {
		name: node.tag,
		start: node.loc.start.offset,
		end: node.loc.end.offset,
		innerStart,
		innerEnd,
		lang,
		content: source.slice(innerStart, innerEnd),
		attrs,
	};
}
