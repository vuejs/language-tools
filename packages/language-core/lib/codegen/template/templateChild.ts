import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { endOfLine, newLine } from '../common';
import type { TemplateCodegenContext } from './context';
import { generateComponent, generateElement } from './element';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateSlotOutlet } from './slotOutlet';
import { generateVFor } from './vFor';
import { generateVIf } from './vIf';

// @ts-ignore
const transformContext: CompilerDOM.TransformContext = {
	onError: () => { },
	helperString: str => str.toString(),
	replaceNode: () => { },
	cacheHandlers: false,
	prefixIdentifiers: false,
	scopes: {
		vFor: 0,
		vOnce: 0,
		vPre: 0,
		vSlot: 0,
	},
	expressionPlugins: ['typescript'],
};

export function* generateTemplateChild(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	prevNode: CompilerDOM.TemplateChildNode | undefined,
	componentCtxVar: string | undefined
): Generator<Code> {
	if (prevNode?.type === CompilerDOM.NodeTypes.COMMENT) {
		const commentText = prevNode.content.trim().split(' ')[0];
		if (commentText.match(/^@vue-skip\b[\s\S]*/)) {
			yield `// @vue-skip${newLine}`;
			return;
		}
		else if (commentText.match(/^@vue-ignore\b[\s\S]*/)) {
			yield* ctx.ignoreError();
		}
		else if (commentText.match(/^@vue-expect-error\b[\s\S]*/)) {
			yield* ctx.expectError(prevNode);
		}
	}

	const shouldInheritRootNodeAttrs = options.inheritAttrs;

	const cur = node as CompilerDOM.ElementNode | CompilerDOM.IfNode | CompilerDOM.ForNode;
	if (cur.codegenNode?.type === CompilerDOM.NodeTypes.JS_CACHE_EXPRESSION) {
		cur.codegenNode = cur.codegenNode.value as any;
	}

	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		let prev: CompilerDOM.TemplateChildNode | undefined;
		if (shouldInheritRootNodeAttrs && node.children.length === 1 && node.children[0].type === CompilerDOM.NodeTypes.ELEMENT) {
			ctx.singleRootNode = node.children[0];
		}
		for (const childNode of node.children) {
			yield* generateTemplateChild(options, ctx, childNode, currentComponent, prev, componentCtxVar);
			prev = childNode;
		}
		yield* ctx.resetDirectiveComments('end of root');
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		const vForNode = getVForNode(node);
		const vIfNode = getVIfNode(node);
		if (vForNode) {
			yield* generateVFor(options, ctx, vForNode, currentComponent, componentCtxVar);
		}
		else if (vIfNode) {
			yield* generateVIf(options, ctx, vIfNode, currentComponent, componentCtxVar);
		}
		else {
			if (node.tagType === CompilerDOM.ElementTypes.SLOT) {
				yield* generateSlotOutlet(options, ctx, node, currentComponent, componentCtxVar);
			}
			else if (
				node.tagType === CompilerDOM.ElementTypes.ELEMENT
				|| node.tagType === CompilerDOM.ElementTypes.TEMPLATE
			) {
				yield* generateElement(options, ctx, node, currentComponent, componentCtxVar);
			}
			else {
				yield* generateComponent(options, ctx, node, currentComponent);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
		// {{ var }}
		yield* generateTemplateChild(options, ctx, node.content, currentComponent, undefined, componentCtxVar);
	}
	else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
		// {{ ... }} {{ ... }}
		for (const childNode of node.children) {
			if (typeof childNode === 'object') {
				yield* generateTemplateChild(options, ctx, childNode, currentComponent, undefined, componentCtxVar);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
		// {{ ... }}
		const [content, start] = parseInterpolationNode(node, options.template.content);
		yield* generateInterpolation(
			options,
			ctx,
			content,
			node.content.loc,
			start,
			ctx.codeFeatures.all,
			`(`,
			`)${endOfLine}`
		);
		yield* ctx.resetDirectiveComments('end of INTERPOLATION');
	}
	else if (node.type === CompilerDOM.NodeTypes.IF) {
		// v-if / v-else-if / v-else
		yield* generateVIf(options, ctx, node, currentComponent, componentCtxVar);
	}
	else if (node.type === CompilerDOM.NodeTypes.FOR) {
		// v-for
		yield* generateVFor(options, ctx, node, currentComponent, componentCtxVar);
	}
	else if (node.type === CompilerDOM.NodeTypes.TEXT) {
		// not needed progress
	}
}

// TODO: track https://github.com/vuejs/vue-next/issues/3498
export function getVForNode(node: CompilerDOM.ElementNode) {
	const forDirective = node.props.find(
		(prop): prop is CompilerDOM.DirectiveNode =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'for'
	);
	if (forDirective) {
		let forNode: CompilerDOM.ForNode | undefined;
		CompilerDOM.processFor(node, forDirective, transformContext, _forNode => {
			forNode = { ..._forNode };
			return undefined;
		});
		if (forNode) {
			forNode.children = [{
				...node,
				props: node.props.filter(prop => prop !== forDirective),
			}];
			return forNode;
		}
	}
}

function getVIfNode(node: CompilerDOM.ElementNode) {
	const forDirective = node.props.find(
		(prop): prop is CompilerDOM.DirectiveNode =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'if'
	);
	if (forDirective) {
		let ifNode: CompilerDOM.IfNode | undefined;
		CompilerDOM.processIf(node, forDirective, transformContext, _ifNode => {
			ifNode = { ..._ifNode };
			return undefined;
		});
		if (ifNode) {
			for (const branch of ifNode.branches) {
				branch.children = [{
					...node,
					props: node.props.filter(prop => prop !== forDirective),
				}];
			}
			return ifNode;
		}
	}
}

export function parseInterpolationNode(node: CompilerDOM.InterpolationNode, template: string) {
	let content = node.content.loc.source;
	let start = node.content.loc.start.offset;
	let leftCharacter: string;
	let rightCharacter: string;

	// fix https://github.com/vuejs/language-tools/issues/1787
	while ((leftCharacter = template.substring(start - 1, start)).trim() === '' && leftCharacter.length) {
		start--;
		content = leftCharacter + content;
	}
	while ((rightCharacter = template.substring(start + content.length, start + content.length + 1)).trim() === '' && rightCharacter.length) {
		content = content + rightCharacter;
	}

	return [
		content,
		start,
	] as const;
}
