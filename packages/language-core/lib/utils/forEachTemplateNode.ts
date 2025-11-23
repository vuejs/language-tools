import * as CompilerDOM from '@vue/compiler-dom';

export function* forEachElementNode(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode,
): Generator<CompilerDOM.ElementNode> {
	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const child of node.children) {
			yield* forEachElementNode(child);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		yield node;
		for (const child of node.children) {
			yield* forEachElementNode(child);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.IF) {
		for (const branch of node.branches) {
			for (const childNode of branch.children) {
				yield* forEachElementNode(childNode);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.FOR) {
		for (const child of node.children) {
			yield* forEachElementNode(child);
		}
	}
}

export function* forEachInterpolationNode(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
): Generator<CompilerDOM.InterpolationNode> {
	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const child of node.children) {
			yield* forEachInterpolationNode(child);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		for (const child of node.children) {
			yield* forEachInterpolationNode(child);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
		for (const child of node.children) {
			if (typeof child === 'object') {
				yield* forEachInterpolationNode(child);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
		yield node;
	}
	else if (node.type === CompilerDOM.NodeTypes.IF) {
		for (const branch of node.branches) {
			for (const childNode of branch.children) {
				yield* forEachInterpolationNode(childNode);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.FOR) {
		for (const child of node.children) {
			yield* forEachInterpolationNode(child);
		}
	}
}
