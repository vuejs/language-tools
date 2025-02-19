import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { hyphenateTag } from '../../utils/shared';
import { endOfLine, newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import { generateComponent, generateElement } from './element';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateSlotOutlet } from './slotOutlet';
import { generateVFor } from './vFor';
import { generateVIf } from './vIf';
import { generateVSlot } from './vSlot';

const commentDirectiveRegex = /^<!--\s*@vue-(?<name>[-\w]+)\b(?<content>[\s\S]*)-->$/;

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
	prevNode: CompilerDOM.TemplateChildNode | undefined,
	isVForChild: boolean = false
): Generator<Code> {
	if (prevNode?.type === CompilerDOM.NodeTypes.COMMENT) {
		const match = prevNode.loc.source.match(commentDirectiveRegex);
		if (match) {
			const { name, content } = match.groups!;
			switch (name) {
				case 'skip': {
					yield `// @vue-skip${newLine}`;
					return;
				}
				case 'ignore': {
					yield* ctx.ignoreError();
					break;
				}
				case 'expect-error': {
					yield* ctx.expectError(prevNode);
					break;
				}
				case 'generic': {
					const text = content.trim();
					if (text.startsWith('{') && text.endsWith('}')) {
						ctx.lastGenericComment = {
							content: text.slice(1, -1),
							offset: prevNode.loc.start.offset + prevNode.loc.source.indexOf('{') + 1,
						};
					}
					break;
				}
			}
		}
	}

	const cur = node as CompilerDOM.ElementNode | CompilerDOM.IfNode | CompilerDOM.ForNode;
	if (cur.codegenNode?.type === CompilerDOM.NodeTypes.JS_CACHE_EXPRESSION) {
		cur.codegenNode = cur.codegenNode.value as any;
	}

	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const item of collectSingleRootNodes(options, node.children)) {
			ctx.singleRootNodes.add(item);
		}
		let prev: CompilerDOM.TemplateChildNode | undefined;
		for (const childNode of node.children) {
			yield* generateTemplateChild(options, ctx, childNode, prev);
			prev = childNode;
		}
		yield* ctx.resetDirectiveComments('end of root');
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		const vForNode = getVForNode(node);
		const vIfNode = getVIfNode(node);
		if (vForNode) {
			yield* generateVFor(options, ctx, vForNode);
		}
		else if (vIfNode) {
			yield* generateVIf(options, ctx, vIfNode);
		}
		else if (node.tagType === CompilerDOM.ElementTypes.SLOT) {
			yield* generateSlotOutlet(options, ctx, node);
		}
		else {
			const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
			if (
				node.tagType === CompilerDOM.ElementTypes.TEMPLATE
				&& ctx.currentComponent
				&& slotDir
			) {
				yield* generateVSlot(options, ctx, node, slotDir);
			}
			else if (
				node.tagType === CompilerDOM.ElementTypes.ELEMENT
				|| node.tagType === CompilerDOM.ElementTypes.TEMPLATE
			) {
				yield* generateElement(options, ctx, node, isVForChild);
			}
			else {
				const { currentComponent } = ctx;
				yield* generateComponent(options, ctx, node, isVForChild);
				ctx.currentComponent = currentComponent;
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
		// {{ var }}
		yield* generateTemplateChild(options, ctx, node.content, undefined);
	}
	else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
		// {{ ... }} {{ ... }}
		for (const childNode of node.children) {
			if (typeof childNode === 'object') {
				yield* generateTemplateChild(options, ctx, childNode, undefined);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
		// {{ ... }}
		const [content, start] = parseInterpolationNode(node, options.template.content);
		yield* generateInterpolation(
			options,
			ctx,
			'template',
			ctx.codeFeatures.all,
			content,
			start,
			node.content.loc,
			`(`,
			`)${endOfLine}`
		);
		yield* ctx.resetDirectiveComments('end of INTERPOLATION');
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
}

function* collectSingleRootNodes(
	options: TemplateCodegenOptions,
	children: CompilerDOM.TemplateChildNode[]
): Generator<CompilerDOM.ElementNode | null> {
	if (children.length !== 1) {
		// "null" is used to determine whether the component is not always has a single root
		if (children.length > 1) {
			yield null;
		}
		return;
	}

	const child = children[0];
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
	const ifDirective = node.props.find(
		(prop): prop is CompilerDOM.DirectiveNode =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'if'
	);
	if (ifDirective) {
		let ifNode: CompilerDOM.IfNode | undefined;
		CompilerDOM.processIf(node, ifDirective, transformContext, _ifNode => {
			ifNode = { ..._ifNode };
			return undefined;
		});
		if (ifNode) {
			for (const branch of ifNode.branches) {
				branch.children = [{
					...node,
					props: node.props.filter(prop => prop !== ifDirective),
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
	while ((leftCharacter = template.slice(start - 1, start)).trim() === '' && leftCharacter.length) {
		start--;
		content = leftCharacter + content;
	}
	while ((rightCharacter = template.slice(start + content.length, start + content.length + 1)).trim() === '' && rightCharacter.length) {
		content = content + rightCharacter;
	}

	return [
		content,
		start,
	] as const;
}
