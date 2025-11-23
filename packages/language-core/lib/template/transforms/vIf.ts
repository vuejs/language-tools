import {
	createCompilerError,
	createSimpleExpression,
	type DirectiveNode,
	type ElementNode,
	ElementTypes,
	ErrorCodes,
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
			const loc = dir.exp ? dir.exp.loc : node.loc;
			context.onError(
				createCompilerError(ErrorCodes.X_V_IF_NO_EXPRESSION, dir.loc),
			);
			dir.exp = createSimpleExpression('', false, loc);
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
					if (
						(dir.name === 'else-if' || dir.name === 'else')
						&& !sibling.branches.at(-1)!.condition
					) {
						context.onError(
							createCompilerError(ErrorCodes.X_V_ELSE_NO_ADJACENT_IF, node.loc),
						);
					}

					context.removeNode();
					const branch = createIfBranch(node, dir);
					if (comments.length) {
						branch.children.unshift(...comments);
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
	const isTemplateIf = node.tagType === ElementTypes.TEMPLATE;
	return {
		type: NodeTypes.IF_BRANCH,
		loc: node.loc,
		condition: dir.name === 'else' ? undefined : dir.exp,
		children: [node],
		isTemplateIf,
	};
}
