import {
	type CompoundExpressionNode,
	createCompoundExpression,
	isText,
	type NodeTransform,
	NodeTypes,
} from '@vue/compiler-dom';

export const transformText: NodeTransform = node => {
	if (
		node.type === NodeTypes.ROOT
		|| node.type === NodeTypes.ELEMENT
		|| node.type === NodeTypes.FOR
		|| node.type === NodeTypes.IF_BRANCH
	) {
		return () => {
			const children = node.children;
			let currentContainer: CompoundExpressionNode | undefined = undefined;

			for (let i = 0; i < children.length; i++) {
				const child = children[i]!;
				if (isText(child)) {
					for (let j = i + 1; j < children.length; j++) {
						const next = children[j]!;
						if (isText(next)) {
							currentContainer ??= children[i] = createCompoundExpression([child], child.loc);
							currentContainer.children.push(` + `, next);
							children.splice(j, 1);
							j--;
						}
						else {
							currentContainer = undefined;
							break;
						}
					}
				}
			}
		};
	}
};
