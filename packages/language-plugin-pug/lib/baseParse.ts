import type { Mapping } from '@volar/source-map';
import pugLex from 'pug-lexer';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { buildMappings, type PugCode } from './buildMappings';

const pugParser = require('pug-parser');

const indentedPrefix = 'template\n';

/**
 * Vue dedents a pug template (`dedent` of `@vue/compiler-sfc`), but pug reads an indented first line as an
 * error, so an indented template is parsed as the children of a `template` tag. The tag is blanked out of
 * the HTML and left out of the mappings, the AST and the positions, which are all of `pugCode`.
 */
export function baseParse(pugCode: string): ReturnType<typeof parse> {
	if (calculateMinIndent(pugCode) === 0) {
		return parse(pugCode);
	}
	const parsed = parse(indentedPrefix + pugCode);
	const prefixLength = indentedPrefix.length;
	return {
		htmlCode: ' '.repeat('<template>'.length)
			+ parsed.htmlCode.slice('<template>'.length, -'</template>'.length)
			+ ' '.repeat('</template>'.length),
		mappings: parsed.mappings
			.filter(mapping => mapping[2] >= prefixLength)
			.map((mapping): Mapping => [
				mapping[0],
				mapping[1],
				mapping[2] - prefixLength,
				mapping[3],
				mapping[4],
				mapping[5],
			]),
		pugTextDocument: TextDocument.create('file:///file.pug', 'pug', 0, pugCode),
		error: parsed.error && { ...parsed.error, line: parsed.error.line - 1 },
		ast: parsed.ast && toPrevLine(((parsed.ast as BlockNode).nodes[0] as TagNode).block),
		emptyLineEnds: parsed.emptyLineEnds.map(offset => offset - prefixLength),
	};
}

function calculateMinIndent(s: string) {
	const lines = s.split('\n');
	const minIndent = lines.reduce(function(minIndent, line) {
		if (line.trim() === '') {
			return minIndent;
		}
		const indent = line.match(/^\s*/)?.[0]?.length || 0;
		return Math.min(indent, minIndent);
	}, Infinity);
	return minIndent;
}

function toPrevLine<T extends object>(node: T): T {
	const visited = new Set<object>();
	visit(node);
	return node;

	function visit(obj: object) {
		if (visited.has(obj)) {
			return;
		}
		visited.add(obj);
		if ('line' in obj && typeof obj.line === 'number') {
			obj.line--;
		}
		for (const value of Object.values(obj)) {
			if (value && typeof value === 'object') {
				visit(value);
			}
		}
	}
}

function parse(pugCode: string) {
	const fileName = 'file.pug';
	const pugTextDocument = TextDocument.create('file:///file.pug', 'pug', 0, pugCode);
	const codes: PugCode[] = [];
	let error: {
		code: string;
		msg: string;
		line: number;
		column: number;
		filename: string;
	} | undefined;
	let emptyLineEnds: ReturnType<typeof collectEmptyLineEnds> = [];
	let attrsBlocks: ReturnType<typeof collectAttrsBlocks>;
	let ast: Node | undefined;

	try {
		const tokens = pugLex(pugCode, { filename: fileName });

		emptyLineEnds = collectEmptyLineEnds(tokens);
		attrsBlocks = collectAttrsBlocks(tokens);
		ast = pugParser(tokens, { filename: fileName, src: pugCode }) as Node;

		visitNode(ast, undefined, undefined);

		codes.push([
			'',
			pugCode.trimEnd().length,
		]);
	}
	catch (e) {
		const _error = e as NonNullable<typeof error>;
		error = {
			..._error,
			line: _error.line - 1,
			column: _error.column - 1,
		};
	}

	return {
		htmlCode: codes.map(code => typeof code === 'string' ? code : code[0]).join(''),
		mappings: buildMappings(codes),
		pugTextDocument,
		error,
		ast,
		emptyLineEnds,
	};

	function visitNode(node: Node, next: Node | undefined, parent: Node | undefined) {
		if (node.type === 'Block') {
			for (let i = 0; i < node.nodes.length; i++) {
				visitNode(node.nodes[i]!, node.nodes[i + 1], node);
			}
		}
		else if (node.type === 'Mixin') {
			if (node.block) {
				visitNode(node.block, undefined, node);
			}
		}
		else if (node.type === 'Tag') {
			const pugTagRange = getDocRange(node.line, node.column, node.name.length);

			codes.push([
				'',
				pugTagRange.start,
			]);

			const selfClosing = node.block.nodes.length === 0;
			addStartTag(node, selfClosing);
			if (!selfClosing) {
				visitNode(node.block, next, parent);
				addEndTag(node, next, parent);
			}
			codes.push([
				'',
				pugTagRange.start,
			]);
		}
		else if (node.type === 'Text') {
			codes.push([
				node.val,
				getDocOffset(node.line, node.column),
			]);
		}
	}

	function addStartTag(node: TagNode, selfClosing: boolean) {
		codes.push([
			'',
			getDocOffset(node.line, node.column),
		]);
		codes.push('<');
		const tagRange = getDocRange(node.line, node.column, node.name.length);
		if (pugCode.substring(tagRange.start, tagRange.end) === node.name) {
			codes.push([
				node.name,
				tagRange.start,
			]);
		}
		else {
			codes.push(node.name);
		}

		for (const attr of node.attrs.filter(attr => !attr.mustEscape)) {
			codes.push(' ');
			if (attr.name === 'class' || attr.name === 'id') {
				const offset = getDocOffset(attr.line, attr.column);
				for (const char of attr.name) {
					codes.push([
						char,
						offset,
					]);
				}
			}
			else {
				codes.push(attr.name);
			}
			if (typeof attr.val !== 'boolean') {
				codes.push('=');
				codes.push([
					attr.val,
					getDocOffset(attr.line, attr.column),
				]);
			}
		}

		const attrsBlock = attrsBlocks.get(getDocOffset(node.line, node.column)); // support attr auto-complete in spaces
		if (attrsBlock) {
			codes.push(' ');
			codes.push([
				attrsBlock.text,
				attrsBlock.offset,
			]);
		}

		if (selfClosing) {
			codes.push(' />');
		}
		else {
			codes.push('>');
		}
	}

	function addEndTag(node: TagNode, next: Node | undefined, parent: Node | undefined) {
		let nextStart: number | undefined;
		if (next) {
			if (next.type === 'Block') {
				nextStart = getDocOffset(next.line, 1);
			}
			else {
				nextStart = getDocOffset(next.line, next.column);
			}
		}
		else if (!parent) {
			nextStart = pugCode.length;
		}
		if (nextStart !== undefined) {
			codes.push([
				'',
				nextStart,
			]);
		}
		codes.push(`</${node.name}>`);
	}

	function collectEmptyLineEnds(tokens: pugLex.Token[]) {
		const ends: number[] = [];

		for (const token of tokens) {
			if (token.type === 'newline' || token.type === 'outdent') {
				let currentLine = token.loc.start.line - 2;
				let prevLine = getLineText(pugTextDocument, currentLine);
				while (prevLine.trim() === '') {
					ends.push(pugTextDocument.offsetAt({ line: currentLine + 1, character: 0 }) - 1);
					if (currentLine <= 0) {
						break;
					}
					currentLine--;
					prevLine = getLineText(pugTextDocument, currentLine);
				}
			}
		}

		return ends.sort((a, b) => a - b);
	}

	function collectAttrsBlocks(tokens: pugLex.Token[]) {
		const blocks = new Map<number, { offset: number; text: string }>();

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i]!;
			if (token.type === 'start-attributes') {
				let tagStart: pugLex.Token = token;

				for (let j = i - 1; j >= 0; j--) {
					const prevToken = tokens[j]!;

					if (
						prevToken.type === 'newline'
						|| prevToken.type === 'indent'
						|| prevToken.type === 'outdent'
						|| prevToken.type === ':'
					) {
						break;
					}

					tagStart = prevToken;

					if (prevToken.type === 'tag') {
						break;
					}
				}

				let prevToken: pugLex.Token = token;
				let text = '';

				for (i++; i < tokens.length; i++) {
					const attrToken = tokens[i]!;
					addPrevSpace(attrToken);

					if (attrToken.type === 'attribute') {
						let attrText = pugCode.substring(
							getDocOffset(attrToken.loc.start.line, attrToken.loc.start.column),
							getDocOffset(attrToken.loc.end.line, attrToken.loc.end.column),
						);
						if (typeof attrToken.val === 'string' && attrText.includes('=')) {
							let valText = attrToken.val;
							if (valText.startsWith('`') && valText.endsWith('`')) {
								const innerContent = valText.slice(1, -1);
								if (!innerContent.includes('"')) {
									valText = `"${innerContent}"`;
								}
								else if (!innerContent.includes("'")) {
									valText = `'${innerContent}'`;
								}
								else {
									// Both quote types present: convert inner single quotes to double quotes
									// This allows using single quotes as the outer delimiter
									// JavaScript accepts both 'str' and "str" for string literals
									valText = `'${innerContent.replace(/'/g, '"')}'`;
								}
							}
							valText = valText.replace(/ \\\n/g, '//\n');
							text += attrText.substring(0, attrText.lastIndexOf(attrToken.val)) + valText;
						}
						else {
							text += attrText;
						}
					}
					else if (attrToken.type === 'end-attributes') {
						blocks.set(getDocOffset(tagStart.loc.start.line, tagStart.loc.start.column), {
							offset: getDocOffset(token.loc.end.line, token.loc.end.column),
							text,
						});
						break;
					}

					prevToken = attrToken;
				}

				function addPrevSpace(currentToken: pugLex.Token) {
					text += pugCode.substring(
						getDocOffset(prevToken.loc.end.line, prevToken.loc.end.column),
						getDocOffset(currentToken.loc.start.line, currentToken.loc.start.column),
					).replace(/,/g, '\n');
				}
			}
		}

		return blocks;
	}

	function getDocOffset(pugLine: number, pugColumn: number) {
		return pugTextDocument.offsetAt({ line: pugLine - 1, character: pugColumn - 1 });
	}

	function getDocRange(pugLine: number, pugColumn: number, length: number) {
		const start = getDocOffset(pugLine, pugColumn);
		const end = start + length;
		return {
			start,
			end,
		};
	}
}

export type Node = BlockNode | MixinNode | TagNode | TextNode | CommentNode | BlockCommentNode;

export interface BlockNode {
	type: 'Block';
	nodes: Node[];
	line: number;
}

export interface TagNode {
	type: 'Tag';
	name: string;
	selfClosing: boolean;
	block: BlockNode;
	attrs: {
		name: string;
		val: string | true;
		line: number;
		column: number;
		mustEscape: boolean;
	}[];
	attributeBlocks: {
		// ?
	}[];
	isInline: boolean;
	line: number;
	column: number;
}

export interface TextNode {
	type: 'Text';
	val: string;
	line: number;
	column: number;
}

export interface CommentNode {
	type: 'Comment';
	val: string;
	buffer: boolean;
	line: number;
	column: number;
}

export interface BlockCommentNode {
	type: 'BlockComment';
	block: BlockNode;
	val: string;
	buffer: boolean;
	line: number;
	column: number;
}

export interface MixinNode {
	type: 'Mixin';
	name: string;
	args: null;
	block: BlockNode | null;
	line: number;
	column: number;
}

function getLineText(document: TextDocument, line: number) {
	const endOffset = document.offsetAt({ line: line + 1, character: 0 });
	const end = document.positionAt(endOffset);
	const text = document.getText({
		start: { line: line, character: 0 },
		end: end.line === line ? end : document.positionAt(endOffset - 1),
	});
	return text;
}
