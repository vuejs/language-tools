import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateTemplateChild, getVIfNode } from './templateChild';

export function* generateElementChildren(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	children: (CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode)[],
	enterNode = true,
): Generator<Code> {
	const endScope = ctx.startScope();
	for (let i = 0; i < children.length; i++) {
		const current = children[i]!;
		const normalized = normalizeIfBranch(children, i);
		if (normalized) {
			i = normalized.end;
			yield* generateTemplateChild(options, ctx, normalized.node, enterNode);
			continue;
		}
		yield* generateTemplateChild(options, ctx, current, enterNode);
	}
	yield* endScope();
}

function normalizeIfBranch(
	children: (CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode)[],
	start: number,
): { node: CompilerDOM.IfNode; end: number } | undefined {
	const first = children[start]!;
	if (!isTemplateChildNode(first)) {
		return;
	}
	if (first.type === CompilerDOM.NodeTypes.IF) {
		return { node: first, end: start };
	}
	if (first.type !== CompilerDOM.NodeTypes.ELEMENT) {
		return;
	}

	const ifNode = getVIfNode(first);
	if (!ifNode) {
		return;
	}

	let end = start;
	let comments: CompilerDOM.CommentNode[] = [];

	for (let i = start + 1; i < children.length; i++) {
		const sibling = children[i]!;
		if (!isTemplateChildNode(sibling)) {
			continue;
		}
		if (sibling.type === CompilerDOM.NodeTypes.COMMENT) {
			comments.push(sibling);
			continue;
		}
		if (sibling.type === CompilerDOM.NodeTypes.TEXT && !sibling.content.trim()) {
			continue;
		}
		const elseBranch = getVElseDirective(sibling);
		if (elseBranch) {
			const branchNode: CompilerDOM.ElementNode = {
				...elseBranch.element,
				props: elseBranch.element.props.filter(prop => prop !== elseBranch.directive),
			};

			const branch = createIfBranch(branchNode, elseBranch.directive);
			if (comments.length) {
				branch.children = [...comments, ...branch.children];
			}

			ifNode.branches.push(branch);
			comments = [];
			end = i;
			continue;
		}
		break;
	}

	return { node: ifNode, end };
}

function createIfBranch(node: CompilerDOM.ElementNode, dir: CompilerDOM.DirectiveNode): CompilerDOM.IfBranchNode {
	const isTemplateIf = node.tagType === CompilerDOM.ElementTypes.TEMPLATE;
	return {
		type: CompilerDOM.NodeTypes.IF_BRANCH,
		loc: node.loc,
		condition: dir.name === 'else' ? undefined : dir.exp,
		children: isTemplateIf && !CompilerDOM.findDir(node, 'for') ? node.children : [node],
		userKey: CompilerDOM.findProp(node, 'key'),
		isTemplateIf,
	};
}

function getVElseDirective(node: CompilerDOM.TemplateChildNode) {
	if (node.type !== CompilerDOM.NodeTypes.ELEMENT) {
		return;
	}
	const directive = node.props.find(
		(prop): prop is CompilerDOM.DirectiveNode =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& (prop.name === 'else-if' || prop.name === 'else'),
	);
	if (directive) {
		return {
			element: node,
			directive,
		};
	}
}

function isTemplateChildNode(
	node: CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
): node is CompilerDOM.TemplateChildNode {
	return node.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION;
}
