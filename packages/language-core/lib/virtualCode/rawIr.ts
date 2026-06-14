import * as CompilerDOM from '@vue/compiler-dom';
import { transformTemplate } from '../template/compile';
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
	initialValue?: {
		ast: CompilerDOM.RootNode;
		errors: CompilerDOM.CompilerError[];
		warnings: CompilerDOM.CompilerError[];
	};
}

export interface RawIRParseResult {
	rawIr: RawIR;
	errors: CompilerDOM.CompilerError[];
	warnings: CompilerDOM.CompilerError[];
}

export function parseRawIR(source: string, options: CompilerDOM.CompilerOptions): RawIRParseResult {
	const errors: CompilerDOM.CompilerError[] = [];
	const warnings: CompilerDOM.CompilerError[] = [];
	const ast = CompilerDOM.parse(
		source,
		options = {
			...options,
			parseMode: 'sfc',
			onError: err => errors.push(err),
			onWarn: err => warnings.push(err),
		},
	);

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
				block.initialValue = {
					ast: {
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
					},
					errors: [],
					warnings: [],
				};
				for (const loc of traverseLoc(block.initialValue.ast)) {
					loc.start.offset -= block.innerStart;
					loc.end.offset -= block.innerStart;
				}
				for (const [key, list] of [['errors', errors], ['warnings', warnings]] as const) {
					for (const item of list) {
						if (item.loc && item.loc.start.offset >= block.innerStart && item.loc.end.offset <= block.innerEnd) {
							item.loc.start.offset -= block.innerStart;
							item.loc.end.offset -= block.innerStart;
							block.initialValue[key].push(
								...list.splice(list.indexOf(item), 1)!,
							);
						}
					}
				}
				transformTemplate(block.initialValue.ast, options);
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

function* traverseLoc(obj: Record<string, any>): Generator<CompilerDOM.SourceLocation> {
	for (const key in obj) {
		const value = obj[key];
		if (value && typeof value === 'object') {
			if ('loc' in value) {
				yield value.loc;
			}
			yield* traverseLoc(value);
		}
	}
}
