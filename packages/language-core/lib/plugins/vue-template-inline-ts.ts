import type { CodeInformation } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { isCompoundExpression } from '../codegen/template/elementEvents';
import { parseInterpolationNode } from '../codegen/template/templateChild';
import { parseVForNode } from '../codegen/template/vFor';
import { createTsAst } from '../codegen/utils';
import type { Code, Sfc, VueLanguagePlugin } from '../types';

const codeFeatures: CodeInformation = {
	format: true,
};
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

const plugin: VueLanguagePlugin = ctx => {

	const parseds = new WeakMap<Sfc, ReturnType<typeof parse>>();

	return {

		version: 2.1,

		getEmbeddedCodes(_fileName, sfc) {
			if (!sfc.template?.ast) {
				return [];
			}
			const parsed = parse(sfc);
			parseds.set(sfc, parsed);
			const result: {
				id: string;
				lang: string;
			}[] = [];
			for (const [id] of parsed) {
				result.push({ id, lang: 'ts' });
			}
			return result;
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			// access template content to watch change
			(() => sfc.template?.content)();

			const parsed = parseds.get(sfc);
			if (parsed) {
				const codes = parsed.get(embeddedFile.id);
				if (codes) {
					embeddedFile.content.push(...codes);
					embeddedFile.parentCodeId = 'template';
				}
			}
		},
	};

	function parse(sfc: Sfc) {
		const data = new Map<string, Code[]>();
		if (!sfc.template?.ast) {
			return data;
		}
		const templateContent = sfc.template.content;
		let i = 0;
		sfc.template.ast.children.forEach(visit);
		return data;

		function visit(node: CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode) {
			if (node.type === CompilerDOM.NodeTypes.COMMENT) {
				const match = node.loc.source.match(/^<!--\s*@vue-generic\s*\{(?<content>[\s\S]*)\}\s*-->$/);
				if (match) {
					const { content } = match.groups!;
					addFormatCodes(
						content,
						node.loc.start.offset + node.loc.source.indexOf('{') + 1,
						formatBrackets.generic
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
							formatBrackets.normal
						);
					}
					if (
						prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
						&& prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY // style='z-index: 2' will compile to {'z-index':'2'}
					) {
						if (prop.name === 'on' && prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
							const ast = createTsAst(ctx.modules.typescript, prop.exp, prop.exp.content);
							if (isCompoundExpression(ctx.modules.typescript, ast)) {
								addFormatCodes(
									prop.exp.loc.source,
									prop.exp.loc.start.offset,
									formatBrackets.event
								);
							}
							else {
								const lines = prop.exp.content.split('\n');
								const firstLineEmpty = lines[0].trim() === '';
								const lastLineEmpty = lines[lines.length - 1].trim() === '';
								if (lines.length <= 1 || (!firstLineEmpty && !lastLineEmpty)) {
									addFormatCodes(
										prop.exp.loc.source,
										prop.exp.loc.start.offset,
										formatBrackets.normal
									);
								}
								else {
									addFormatCodes(
										prop.exp.loc.source,
										prop.exp.loc.start.offset,
										['(', ');']
									);
								}
							}
						}
						else if (prop.name === 'slot') {
							addFormatCodes(
								prop.exp.loc.source,
								prop.exp.loc.start.offset,
								formatBrackets.params
							);
						}
						else if (prop.rawName === 'v-for') {
							// #2586
							addFormatCodes(
								prop.exp.loc.source,
								prop.exp.loc.start.offset,
								formatBrackets.for
							);
						}
						else {
							addFormatCodes(
								prop.exp.loc.source,
								prop.exp.loc.start.offset,
								formatBrackets.normal
							);
						}
					}
				}
				for (const child of node.children) {
					visit(child);
				}
			}
			else if (node.type === CompilerDOM.NodeTypes.IF) {
				for (let i = 0; i < node.branches.length; i++) {
					const branch = node.branches[i];
					if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						addFormatCodes(
							branch.condition.loc.source,
							branch.condition.loc.start.offset,
							formatBrackets.if
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
					while (templateContent[start - 1] === ' ' || templateContent[start - 1] === '(') {
						start--;
					}
					while (templateContent[end] === ' ' || templateContent[end] === ')') {
						end++;
					}
					addFormatCodes(
						templateContent.slice(start, end),
						start,
						formatBrackets.for
					);
				}
				for (const child of node.children) {
					visit(child);
				}
			}
			else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
				// {{ var }}
				visit(node.content);
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
				const [content, start] = parseInterpolationNode(node, templateContent);
				const lines = content.split('\n');
				const firstLineEmpty = lines[0].trim() === '';
				const lastLineEmpty = lines[lines.length - 1].trim() === '';

				if (content.includes('=>')) { // arrow function
					if (lines.length <= 1 || (!firstLineEmpty && !lastLineEmpty)) {
						addFormatCodes(
							content,
							start,
							formatBrackets.normal
						);
					}
					else {
						addFormatCodes(
							content,
							start,
							['(', ');']
						);
					}
				}
				else {
					if (lines.length <= 1 || (!firstLineEmpty && !lastLineEmpty)) {
						addFormatCodes(
							content,
							start,
							formatBrackets.curly
						);
					}
					else {
						addFormatCodes(
							content,
							start,
							[
								firstLineEmpty ? '(' : '(0 +',
								lastLineEmpty ? ');' : '+ 0);'
							]
						);
					}
				}
			}
		}

		function addFormatCodes(code: string, offset: number, wrapper: [string, string]) {
			const id = 'template_inline_ts_' + i++;
			data.set(id, [
				wrapper[0],
				[
					code,
					'template',
					offset,
					codeFeatures,
				],
				wrapper[1],
			]);
		}
	}
};

export default plugin;
