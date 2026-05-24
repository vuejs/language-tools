import {
	type AttributeNode,
	createCompilerError,
	type DirectiveNode,
	type ElementNode,
	ErrorCodes,
	findProp,
	type IfBranchNode,
	type IfNode,
	NodeTypes,
	type SimpleExpressionNode,
	traverseNode,
} from '@vue/compiler-dom';
import { cloneLoc, createStructuralDirectiveTransform } from '../utils';

export const transformIf = createStructuralDirectiveTransform(
	/^(?:if|else-if|else)$/,
	(node, dir, context) => {
		if (
			dir.name !== 'else'
			&& (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim())
		) {
			context.onError(
				createCompilerError(ErrorCodes.X_V_IF_NO_EXPRESSION, dir.loc),
			);
		}

		if (dir.name === 'if') {
			const branch = createIfBranch(node, dir);
			const ifNode: IfNode = {
				type: NodeTypes.IF,
				loc: cloneLoc(node.loc),
				branches: [branch],
			};
			context.replaceNode(ifNode);
		}
		else {
			const siblings = context.parent!.children;
			const comments = [];
			let i = siblings.indexOf(node);
			while (i-- >= -1) {
				const sibling = siblings[i];
				if (sibling?.type === NodeTypes.COMMENT) {
					context.removeNode(sibling);
					comments.unshift(sibling);
					continue;
				}

				if (sibling?.type === NodeTypes.TEXT && !sibling.content.trim().length) {
					context.removeNode(sibling);
					continue;
				}

				if (sibling?.type === NodeTypes.IF) {
					if (!sibling.branches.at(-1)!.condition) {
						context.onError(
							createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
						);
					}

					context.removeNode();
					const branch = createIfBranch(node, dir);
					if (comments.length) {
						branch.children.unshift(...comments);
					}

					if (branch.userKey) {
						for (const { userKey } of sibling.branches) {
							if (isSameKey(userKey, branch.userKey)) {
								context.onError(
									createCompilerError(ErrorCodes.X_V_IF_SAME_KEY, branch.userKey.loc),
								);
							}
						}
					}

					sibling.branches.push(branch);
					traverseNode(branch, context);
					context.currentNode = null;
				}
				else {
					context.onError(
						createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
					);
				}
				break;
			}
		}
	},
);

function createIfBranch(node: ElementNode, dir: DirectiveNode): IfBranchNode {
	return {
		type: NodeTypes.IF_BRANCH,
		loc: node.loc,
		condition: dir.name === 'else' ? undefined : dir.exp,
		children: [node],
		userKey: findProp(node, 'key'),
	};
}

function isSameKey(
	a: AttributeNode | DirectiveNode | undefined,
	b: AttributeNode | DirectiveNode,
): boolean {
	if (!a || a.type !== b.type) {
		return false;
	}
	if (a.type === NodeTypes.ATTRIBUTE) {
		if (a.value!.content !== (b as AttributeNode).value!.content) {
			return false;
		}
	}
	else {
		const exp = a.exp!;
		const branchExp = (b as DirectiveNode).exp!;
		if (
			exp.type !== branchExp.type
			|| exp.type !== NodeTypes.SIMPLE_EXPRESSION
			|| exp.isStatic !== (branchExp as SimpleExpressionNode).isStatic
			|| exp.content !== (branchExp as SimpleExpressionNode).content
		) {
			return false;
		}
	}
	return true;
}
