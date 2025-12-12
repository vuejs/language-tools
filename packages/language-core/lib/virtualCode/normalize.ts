import * as CompilerDOM from '@vue/compiler-dom';
import { forEachElementNode } from '../utils/forEachTemplateNode';

// See https://github.com/vuejs/core/issues/3498
export function normalizeTemplateAST(root: CompilerDOM.RootNode) {
	// @ts-ignore
	const transformContext: CompilerDOM.TransformContext = {
		onError: () => {},
		helperString: str => str.toString(),
		replaceNode: () => {},
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

	for (const { children, codegenNode, props } of forEachElementNode(root)) {
		for (let i = 0; i < children.length; i++) {
			const child = children[i]!;
			if (child.type !== CompilerDOM.NodeTypes.ELEMENT) {
				continue;
			}
			const forNode = getVForNode(child, transformContext);
			if (forNode) {
				children[i] = forNode;
				continue;
			}
			const ifNode = getVIfNode(child, transformContext);
			if (ifNode) {
				const normalized = normalizeIfBranch(ifNode, children, i);
				children.splice(i, normalized.end - i + 1, normalized.node);
				continue;
			}
		}
		// #4539
		if (
			codegenNode
			&& 'props' in codegenNode
			&& codegenNode.props
			&& 'properties' in codegenNode.props
		) {
			for (const p of codegenNode.props.properties) {
				if (
					p.key.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& p.key.content === 'key'
					&& !p.key.isHandlerKey
					&& !p.key.loc.source
					&& p.value.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& p.value.constType === CompilerDOM.ConstantTypes.NOT_CONSTANT
				) {
					const contentBeforeValue = root.loc.source.slice(0, p.value.loc.start.offset);
					const argOffset = contentBeforeValue.lastIndexOf('key');
					props.push({
						type: CompilerDOM.NodeTypes.DIRECTIVE,
						name: 'bind',
						exp: p.value,
						loc: p.loc,
						arg: {
							...p.key,
							loc: {
								start: { line: -1, column: -1, offset: argOffset },
								end: { line: -1, column: -1, offset: argOffset + 'key'.length },
								source: 'key',
							},
						},
						modifiers: [],
					});
					break;
				}
			}
		}
	}
}

function normalizeIfBranch(
	ifNode: CompilerDOM.IfNode,
	children: CompilerDOM.TemplateChildNode[],
	start: number,
): { node: typeof children[number]; end: number } {
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

	return { node: ifNode, end };
}

// source: https://github.com/vuejs/core/blob/25ebe3a42cd80ac0256355c2740a0258cdd7419d/packages/compiler-core/src/transforms/vIf.ts#L207
function createIfBranch(node: CompilerDOM.ElementNode, dir: CompilerDOM.DirectiveNode): CompilerDOM.IfBranchNode {
	const isTemplateIf = node.tagType === CompilerDOM.ElementTypes.TEMPLATE;
	return {
		type: CompilerDOM.NodeTypes.IF_BRANCH,
		loc: node.loc,
		condition: dir.name === 'else' ? undefined : dir.exp,
		children: isTemplateIf && !CompilerDOM.findDir(node, 'for') && !CompilerDOM.findDir(node, 'slot')
			? node.children
			: [node],
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

function getVForNode(node: CompilerDOM.ElementNode, transformContext: CompilerDOM.TransformContext) {
	const forDirective = node.props.find(
		(prop): prop is CompilerDOM.DirectiveNode =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'for',
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

function getVIfNode(node: CompilerDOM.ElementNode, transformContext: CompilerDOM.TransformContext) {
	const ifDirective = node.props.find(
		(prop): prop is CompilerDOM.DirectiveNode =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'if',
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
