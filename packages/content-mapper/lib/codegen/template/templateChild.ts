import * as CompilerDOM from '@vue/compiler-dom';
import { parseInterpolationNode, scriptFeatures } from '@vue/language-core';
import type { TsCode } from '../tsCode';
import { endOfLine } from '../writers';
import type { TemplateCodegenContext } from './context';
import { generateComponent, generateElement, generateFragment } from './element';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateSlotOutlet } from './slotOutlet';
import { generateVFor } from './vFor';
import { generateVIf } from './vIf';
import { generateVSlot } from './vSlot';

export function* generateTemplateChild(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
	enterNode = true,
	treatTemplateAsFragment = false,
): Generator<TsCode> {
	if (enterNode && !ctx.enter(node)) {
		return;
	}
	if (enterNode) {
		yield* ctx.generateDiagnosticDirectiveStart();
	}

	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const child of node.children) {
			yield* generateTemplateChild(options, ctx, child);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		if (node.tagType === CompilerDOM.ElementTypes.SLOT) {
			yield* generateSlotOutlet(options, ctx, node);
		}
		else {
			const slotDir = node.props.find(CompilerDOM.isVSlot);
			if (node.tagType === CompilerDOM.ElementTypes.TEMPLATE && ctx.components.length && slotDir) {
				yield* generateVSlot(options, ctx, node, slotDir, ctx.components.at(-1)!());
			}
			else if (node.tagType === CompilerDOM.ElementTypes.TEMPLATE && treatTemplateAsFragment) {
				yield* generateFragment(options, ctx, node);
			}
			else if (node.tagType === CompilerDOM.ElementTypes.COMPONENT) {
				yield* generateComponent(options, ctx, node);
			}
			else {
				yield* generateElement(options, ctx, node);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
		// {{ ... }} {{ ... }}
		for (const child of node.children) {
			if (typeof child !== 'object') {
				continue;
			}
			yield* generateTemplateChild(options, ctx, child, false);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
		// {{ ... }}
		const [content, start] = parseInterpolationNode(node, options.template.content);
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			{ features: scriptFeatures },
			content,
			start,
			`(`,
			`)${endOfLine}`,
		);
	}
	else if (node.type === CompilerDOM.NodeTypes.IF) {
		// v-if / v-else-if / v-else
		yield* generateVIf(options, ctx, node);
	}
	else if (node.type === CompilerDOM.NodeTypes.FOR) {
		// v-for
		yield* generateVFor(options, ctx, node);
	}

	if (enterNode) {
		yield* ctx.generateDiagnosticDirectiveEnd();
		ctx.exit();
	}
}
