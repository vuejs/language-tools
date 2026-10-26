import * as CompilerDOM from '@vue/compiler-dom';
import {
	type Code,
	type IR,
	isCompoundExpression,
	parseInterpolationNode,
	parseVForNode,
	SpanMapFeature,
	type TypeScript,
} from '@vue/language-core';
import { getTypeScriptAST } from '@vue/language-core/lib/typescript/typescriptAST';
import { embeddedCodeIds, type EmbeddedDocument } from './embeddedDocument';

const formatBrackets = {
	normal: ['`${', '}`;'] as [string, string],
	if: ['if (', ') { }'] as [string, string],
	for: ['for (', ') { }'] as [string, string],
	// fix https://github.com/vuejs/language-tools/issues/3572
	params: ['(', ') => {};'] as [string, string],
	// fix https://github.com/vuejs/language-tools/issues/1210
	// fix https://github.com/vuejs/language-tools/issues/2305
	curly: ['0 +', '+ 0;'] as [string, string],
	event: ['() => ', ';'] as [string, string],
	generic: ['<', '>() => {};'] as [string, string],
};

const genericCommentRE = /^<!--\s*@vue-generic\s*\{(?<content>[\s\S]*)\}\s*-->$/;

/** Each expression of the template wrapped into a TypeScript statement, for the formatter. */
export function getTemplateInlineTsDocuments(ts: TypeScript, ir: IR): EmbeddedDocument[] {
	return [...parse(ts, ir)].map(([id, content]) => ({ id, lang: 'ts', content }));
}

function parse(ts: TypeScript, ir: IR) {
	const result = new Map<string, Code[]>();
	if (!ir.template?.ast) {
		return result;
	}
	const template = ir.template;
	let i = 0;
	ir.template.ast.children.forEach(visit);
	return result;

	function visit(node: CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode) {
		if (node.type === CompilerDOM.NodeTypes.COMMENT) {
			const match = node.loc.source.match(genericCommentRE);
			if (match) {
				const { content } = match.groups!;
				addFormatCodes(
					content!,
					node.loc.start.offset + node.loc.source.indexOf('{') + 1,
					formatBrackets.generic,
				);
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
			for (const prop of node.props) {
				if (prop.type !== CompilerDOM.NodeTypes.DIRECTIVE) {
					continue;
				}
				const isShorthand = prop.arg?.loc.start.offset === prop.exp?.loc.start.offset; // vue 3.4+
				if (isShorthand) {
					continue;
				}
				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && !prop.arg.isStatic) {
					addFormatCodes(
						prop.arg.loc.source,
						prop.arg.loc.start.offset,
						formatBrackets.normal,
					);
				}
				if (
					prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY // style='z-index: 2' will compile to {'z-index':'2'}
				) {
					if (prop.name === 'on' && prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						const ast = getTypeScriptAST(ts, template, prop.exp.content);
						if (isCompoundExpression(ts, ast)) {
							addFormatCodes(
								prop.exp.loc.source,
								prop.exp.loc.start.offset,
								formatBrackets.event,
							);
						}
						else {
							const lines = prop.exp.content.split('\n');
							const firstLineEmpty = lines[0]!.trim() === '';
							const lastLineEmpty = lines[lines.length - 1]!.trim() === '';
							if (lines.length <= 1 || (!firstLineEmpty && !lastLineEmpty)) {
								addFormatCodes(
									prop.exp.loc.source,
									prop.exp.loc.start.offset,
									formatBrackets.normal,
								);
							}
							else {
								addFormatCodes(
									prop.exp.loc.source,
									prop.exp.loc.start.offset,
									['(', ');'],
								);
							}
						}
					}
					else if (prop.name === 'slot') {
						addFormatCodes(
							prop.exp.loc.source,
							prop.exp.loc.start.offset,
							formatBrackets.params,
						);
					}
					else if (prop.rawName === 'v-for') {
						// #2586
						addFormatCodes(
							prop.exp.loc.source,
							prop.exp.loc.start.offset,
							formatBrackets.for,
						);
					}
					else {
						addFormatCodes(
							prop.exp.loc.source,
							prop.exp.loc.start.offset,
							formatBrackets.normal,
						);
					}
				}
			}
			for (const child of node.children) {
				visit(child);
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			for (const branch of node.branches) {
				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					addFormatCodes(
						branch.condition.loc.source,
						branch.condition.loc.start.offset,
						formatBrackets.if,
					);
				}
				for (const childNode of branch.children) {
					visit(childNode);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.FOR) {
			const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
			const { source } = node.parseResult;
			if (leftExpressionRange && leftExpressionText && source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				let start = leftExpressionRange.start;
				let end = source.loc.start.offset + source.content.length;
				while (template.content[start - 1] === ' ' || template.content[start - 1] === '(') {
					start--;
				}
				while (template.content[end] === ' ' || template.content[end] === ')') {
					end++;
				}
				addFormatCodes(
					template.content.slice(start, end),
					start,
					formatBrackets.for,
				);
			}
			for (const child of node.children) {
				visit(child);
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					visit(childNode);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
			// {{ ... }}
			const [content, start] = parseInterpolationNode(node, template.content);
			const lines = content.split('\n');
			const firstLineEmpty = lines[0]!.trim() === '';
			const lastLineEmpty = lines[lines.length - 1]!.trim() === '';

			if (content.includes('=>')) { // arrow function
				if (lines.length <= 1 || (!firstLineEmpty && !lastLineEmpty)) {
					addFormatCodes(
						content,
						start,
						formatBrackets.normal,
					);
				}
				else {
					addFormatCodes(
						content,
						start,
						['(', ');'],
					);
				}
			}
			else {
				if (lines.length <= 1 || (!firstLineEmpty && !lastLineEmpty)) {
					addFormatCodes(
						content,
						start,
						formatBrackets.curly,
					);
				}
				else {
					addFormatCodes(
						content,
						start,
						[
							firstLineEmpty ? '(' : '(0 +',
							lastLineEmpty ? ');' : '+ 0);',
						],
					);
				}
			}
		}
	}

	function addFormatCodes(code: string, offset: number, wrapper: [string, string]) {
		const id = embeddedCodeIds.templateInlineTsPrefix + i++;
		result.set(id, [
			wrapper[0],
			[
				code,
				'template',
				offset,
				{ features: SpanMapFeature.Formatting },
			],
			wrapper[1],
		]);
	}
}
