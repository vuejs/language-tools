import * as CompilerDOM from '@vue/compiler-dom';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { IR, VueCompilerOptions } from '../types';

export interface InlayHintInfo {
	blockName: string;
	offset: number;
	setting: string;
	label: string;
	tooltip?: string;
	paddingRight?: boolean;
	paddingLeft?: boolean;
}

/**
 * Collects inlay hints from the template and script blocks without running the TypeScript code generation.
 */
export function collectInlayHints(
	ir: IR,
	vueCompilerOptions: VueCompilerOptions,
	scriptRanges: ScriptRanges | undefined,
): InlayHintInfo[] {
	const hints: InlayHintInfo[] = [];

	// Collect template hints
	if (ir.template?.ast) {
		collectTemplateHints(ir.template.ast, hints);
	}

	// Collect script options wrapper hints
	if (
		ir.script
		&& scriptRanges?.exportDefault?.isObjectLiteral
		&& vueCompilerOptions.optionsWrapper.length
	) {
		const { expression } = scriptRanges.exportDefault;
		const [wrapLeft, wrapRight] = vueCompilerOptions.optionsWrapper;
		if (wrapLeft) {
			hints.push({
				blockName: 'script',
				offset: expression.start,
				setting: 'vue.inlayHints.optionsWrapper',
				label: wrapLeft,
				tooltip: [
					'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
					'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
				].join('\n\n'),
			});
		}
		if (wrapRight) {
			hints.push({
				blockName: 'script',
				offset: expression.end,
				setting: 'vue.inlayHints.optionsWrapper',
				label: wrapRight,
			});
		}
	}

	return hints;
}

function collectTemplateHints(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode,
	hints: InlayHintInfo[],
) {
	switch (node.type) {
		case CompilerDOM.NodeTypes.IF: {
			for (const branch of node.branches) {
				collectTemplateHints(branch, hints);
			}
			break;
		}
		case CompilerDOM.NodeTypes.IF_BRANCH:
		case CompilerDOM.NodeTypes.FOR:
		case CompilerDOM.NodeTypes.ROOT: {
			for (const child of node.children) {
				collectTemplateHints(child, hints);
			}
			break;
		}
		case CompilerDOM.NodeTypes.ELEMENT: {
			for (const prop of node.props) {
				if (prop.type !== CompilerDOM.NodeTypes.DIRECTIVE) {
					continue;
				}

				const arg = prop.arg;
				const exp = prop.exp;

				// v-bind shorthand: <div :foo /> -> <div :foo="foo" />
				if (
					prop.name === 'bind'
					&& exp
					&& exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& arg.isStatic
					&& arg.loc.end.offset === exp.loc.end.offset
				) {
					const variableName = exp.content;
					hints.push({
						blockName: 'template',
						offset: prop.loc.end.offset,
						setting: 'vue.inlayHints.vBindShorthand',
						label: `="${variableName}"`,
						tooltip: [
							`This is a shorthand for \`${prop.loc.source}="${variableName}"\`.`,
							'To hide this hint, set `vue.inlayHints.vBindShorthand` to `false` in IDE settings.',
							'[More info](https://github.com/vuejs/core/pull/9451)',
						].join('\n\n'),
					});
				}

				// Slot outlet shorthand: <slot #name /> or <component #name />
				if (
					node.tag === 'slot'
					&& prop.name === 'bind'
					&& exp
					&& exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& arg.isStatic
					&& arg.content === 'name'
					&& arg.loc.start.offset === exp.loc.start.offset
				) {
					hints.push({
						blockName: 'template',
						offset: prop.loc.end.offset,
						setting: 'vue.inlayHints.vBindShorthand',
						label: `="name"`,
						tooltip: [
							`This is a shorthand for \`${prop.loc.source}="name"\`.`,
							'To hide this hint, set `vue.inlayHints.vBindShorthand` to `false` in IDE settings.',
							'[More info](https://github.com/vuejs/core/pull/9451)',
						].join('\n\n'),
					});
				}

				// Inline handler: @click="count++" -> @click="$event => count++"
				if (
					prop.name === 'on'
					&& exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& isInlineExpression(exp.content)
				) {
					hints.push({
						blockName: 'template',
						offset: exp.loc.start.offset,
						setting: 'vue.inlayHints.inlineHandlerLeading',
						label: '$event =>',
						paddingRight: true,
						tooltip: [
							'`$event` is a hidden parameter, you can use it in this callback.',
							'To hide this hint, set `vue.inlayHints.inlineHandlerLeading` to `false` in IDE settings.',
							'[More info](https://github.com/vuejs/language-tools/issues/2445#issuecomment-1444771420)',
						].join('\n\n'),
					});
				}
			}

			for (const child of node.children) {
				collectTemplateHints(child, hints);
			}
			break;
		}
	}
}

function isInlineExpression(content: string): boolean {
	const trimmed = content.trim();
	// Inline expressions are those that are not function calls or simple identifiers
	// They include statements like: count++, foo = bar, etc.
	if (!trimmed) {
		return false;
	}
	// Check if it contains arrow function or function keyword
	if (trimmed.includes('=>') || trimmed.includes('function')) {
		return false;
	}
	// Check if it's a simple function call or member access: foo(), foo.bar(), foo.bar.baz()
	if (/^[\w$]+(\.[\w$]+)*\(.*\)?$/.test(trimmed)) {
		return false;
	}
	// Check if it's a simple identifier: foo
	if (/^[\w$]+$/.test(trimmed)) {
		return false;
	}
	// Everything else is considered inline
	return true;
}
