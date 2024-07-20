import type { CodeInformation } from '@volar/language-core';
import { createTsAst } from '../codegen/common';
import { isCompoundExpression } from '../codegen/template/elementEvents';
import { parseInterpolationNode } from '../codegen/template/templateChild';
import { parseVForNode } from '../codegen/template/vFor';
import type { Code, Sfc, VueLanguagePlugin } from '../types';
import * as CompilerDOM from '@vue/compiler-dom';

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
			if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
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
							prop.arg.content,
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
							addFormatCodes(
								prop.exp.content,
								prop.exp.loc.start.offset,
								isCompoundExpression(ctx.modules.typescript, ast)
									? formatBrackets.event
									: formatBrackets.normal
							);
						}
						else {
							addFormatCodes(
								prop.exp.content,
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
							branch.condition.content,
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
					const start = leftExpressionRange.start;
					const end = source.loc.start.offset + source.content.length;
					addFormatCodes(
						templateContent.substring(start, end),
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
				addFormatCodes(
					content,
					start,
					lines.length <= 1 ? formatBrackets.curly : [
						lines[0].trim() === '' ? '(' : formatBrackets.curly[0],
						lines[lines.length - 1].trim() === '' ? ');' : formatBrackets.curly[1],
					]
				);
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
