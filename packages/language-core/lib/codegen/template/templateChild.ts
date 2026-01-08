import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { hyphenateTag } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { endOfLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import { generateComponent, generateElement } from './element';
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
): Generator<Code> {
	if (enterNode && !ctx.enter(node)) {
		return;
	}

	const cur = node as CompilerDOM.ElementNode | CompilerDOM.IfNode | CompilerDOM.ForNode;
	if (cur.codegenNode?.type === CompilerDOM.NodeTypes.JS_CACHE_EXPRESSION) {
		cur.codegenNode = cur.codegenNode.value as any;
	}

	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const item of collectSingleRootNodes(options, node.children)) {
			ctx.singleRootNodes.add(item);
		}
		for (const child of node.children) {
			yield* generateTemplateChild(options, ctx, child);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		let slotDir: CompilerDOM.DirectiveNode | undefined;

		if (node.tagType === CompilerDOM.ElementTypes.SLOT) {
			yield* generateSlotOutlet(options, ctx, node);
		}
		else if (
			node.tagType === CompilerDOM.ElementTypes.TEMPLATE
			&& ctx.components.length
			&& (slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as
				| CompilerDOM.DirectiveNode
				| undefined)
		) {
			yield* generateVSlot(options, ctx, node, slotDir, ctx.components[ctx.components.length - 1]!());
		}
		else if (
			node.tagType === CompilerDOM.ElementTypes.ELEMENT
			|| node.tagType === CompilerDOM.ElementTypes.TEMPLATE
		) {
			yield* generateElement(options, ctx, node);
		}
		else {
			yield* generateComponent(options, ctx, node);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
		// {{ var }}
		yield* generateTemplateChild(options, ctx, node.content, false);
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
			codeFeatures.all,
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
	else if (node.type === CompilerDOM.NodeTypes.TEXT) {
		// not needed progress
	}

	if (enterNode) {
		yield* ctx.exit();
	}
}

function* collectSingleRootNodes(
	options: TemplateCodegenOptions,
	children: CompilerDOM.TemplateChildNode[],
): Generator<CompilerDOM.ElementNode | null> {
	// Exclude the effect of comments on the root node
	children = children.filter(node => node.type !== CompilerDOM.NodeTypes.COMMENT);

	if (children.length !== 1) {
		// "null" is used to determine whether the component is not always has a single root
		if (children.length > 1) {
			yield null;
		}
		return;
	}

	const child = children[0]!;
	if (child.type === CompilerDOM.NodeTypes.IF) {
		for (const branch of child.branches) {
			yield* collectSingleRootNodes(options, branch.children);
		}
		return;
	}
	else if (child.type !== CompilerDOM.NodeTypes.ELEMENT) {
		return;
	}
	yield child;

	const tag = hyphenateTag(child.tag);
	if (options.vueCompilerOptions.fallthroughComponentNames.includes(tag)) {
		yield* collectSingleRootNodes(options, child.children);
	}
}

export function parseInterpolationNode(node: CompilerDOM.InterpolationNode, template: string) {
	let start = node.content.loc.start.offset;
	let end = node.content.loc.end.offset;

	// fix https://github.com/vuejs/language-tools/issues/1787
	while (template[start - 1]?.trim() === '') {
		start--;
	}
	while (template[end]?.trim() === '') {
		end++;
	}

	return [template.slice(start, end), start] as const;
}
