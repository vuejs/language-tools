import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateTemplateChild, getVIfNode } from './templateChild';

export function* generateElementChildren(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	children: CompilerDOM.TemplateChildNode[],
	enterNode = true,
): Generator<Code> {
	const endScope = ctx.startScope();
	for (let i = 0; i < children.length; i++) {
		let current = children[i];
		[current, i] = normalizeIfBranch(children, i);
		yield* generateTemplateChild(options, ctx, current, enterNode);
	}
	yield* endScope();
}

function normalizeIfBranch(
	children: CompilerDOM.TemplateChildNode[],
	start: number,
): [node: typeof children[number], end: number] {
	const first = children[start]!;
	if (first.type !== CompilerDOM.NodeTypes.ELEMENT) {
		return [first, start];
	}

	const ifNode = getVIfNode(first);
	if (!ifNode) {
		return [first, start];
	}

	let end = start;
	let comments: CompilerDOM.CommentNode[] = [];

	for (let i = start + 1; i < children.length; i++) {
		const sibling = children[i]!;
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

	return [ifNode, end];
}

// source: https://github.com/vuejs/core/blob/25ebe3a42cd80ac0256355c2740a0258cdd7419d/packages/compiler-core/src/transforms/vIf.ts#L207
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
