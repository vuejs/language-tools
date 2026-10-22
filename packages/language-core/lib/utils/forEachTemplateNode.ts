import * as CompilerDOM from '@vue/compiler-dom';

export function* forEachElementNode(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode,
): Generator<CompilerDOM.ElementNode> {
	switch (node.type) {
		case CompilerDOM.NodeTypes.ELEMENT: {
			yield node;
		}
		case CompilerDOM.NodeTypes.IF_BRANCH:
		case CompilerDOM.NodeTypes.FOR:
		case CompilerDOM.NodeTypes.ROOT: {
			for (const child of node.children) {
				yield* forEachElementNode(child);
			}
			break;
		}
		case CompilerDOM.NodeTypes.IF: {
			for (const branch of node.branches) {
				yield* forEachElementNode(branch);
			}
			break;
		}
	}
}

export function* forEachInterpolationNode(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
): Generator<CompilerDOM.InterpolationNode> {
	switch (node.type) {
		case CompilerDOM.NodeTypes.ELEMENT:
		case CompilerDOM.NodeTypes.IF_BRANCH:
		case CompilerDOM.NodeTypes.FOR:
		case CompilerDOM.NodeTypes.ROOT: {
			for (const child of node.children) {
				yield* forEachInterpolationNode(child);
			}
			break;
		}
		case CompilerDOM.NodeTypes.IF: {
			for (const branch of node.branches) {
				yield* forEachInterpolationNode(branch);
			}
			break;
		}
		case CompilerDOM.NodeTypes.COMPOUND_EXPRESSION: {
			for (const child of node.children) {
				if (typeof child === 'object') {
					yield* forEachInterpolationNode(child);
				}
			}
			break;
		}
		case CompilerDOM.NodeTypes.INTERPOLATION: {
			yield node;
			break;
		}
	}
}
