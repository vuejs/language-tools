import { type Segment, toString } from 'muggle-string';
import pugLex from 'pug-lexer';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { buildMappings } from './buildMappings';

const pugParser = require('pug-parser');

export function baseParse(pugCode: string) {
	const fileName = 'file.pug';
	const pugTextDocument = TextDocument.create('file:///file.pug', 'pug', 0, pugCode);
	const codes: Segment<any>[] = [];
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
			undefined,
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
		htmlCode: toString(codes),
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
				undefined,
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
				undefined,
				pugTagRange.start,
			]);
		}
		else if (node.type === 'Text') {
			codes.push([
				node.val,
				undefined,
				getDocOffset(node.line, node.column),
			]);
		}
	}

	function addStartTag(node: TagNode, selfClosing: boolean) {
		codes.push([
			'',
			undefined,
			getDocOffset(node.line, node.column),
		]);
		codes.push('<');
		const tagRange = getDocRange(node.line, node.column, node.name.length);
		if (pugCode.substring(tagRange.start, tagRange.end) === node.name) {
			codes.push([
				node.name,
				undefined,
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
						undefined,
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
					undefined,
					getDocOffset(attr.line, attr.column),
				]);
			}
		}

		const attrsBlock = attrsBlocks.get(getDocOffset(node.line, node.column)); // support attr auto-complete in spaces
		if (attrsBlock) {
			codes.push(' ');
			codes.push([
				attrsBlock.text,
				undefined,
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
				undefined,
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
