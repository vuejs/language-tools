import { VueLanguagePlugin } from '../types';
import type * as CompilerDOM from '@vue/compiler-dom';

interface Loc {
	start: { offset: number; };
	end: { offset: number; };
	source: string;
}
type Node = CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.ExpressionNode | CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode;

const plugin: VueLanguagePlugin = ({ modules }) => {

	return {

		version: 1,

		compileSFCTemplate(lang, template, options) {

			if (lang === 'html') {

				const compiler = modules['@vue/compiler-dom'];

				return compiler.compile(template, options);
			}
		},

		updateSFCTemplate(oldResult, change) {

			const CompilerDOM = modules['@vue/compiler-dom'];

			const lengthDiff = change.newText.length - (change.end - change.start);
			let hitNodes: Node[] = [];

			if (tryUpdateNode(oldResult.ast) && hitNodes.length) {
				hitNodes = hitNodes.sort((a, b) => a.loc.source.length - b.loc.source.length);
				const hitNode = hitNodes[0];
				if (hitNode.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					return oldResult;
				}
			}

			function tryUpdateNode(node: Node) {

				if (withinChangeRange(node.loc)) {
					hitNodes.push(node);
				}

				if (tryUpdateNodeLoc(node.loc)) {

					if (node.type === CompilerDOM.NodeTypes.ROOT) {
						for (const child of node.children) {
							if (!tryUpdateNode(child)) {
								return false;
							}
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
						if (withinChangeRange(node.loc)) {
							// if not self closing, should not hit tag name
							const start = node.loc.start.offset + 2;
							const end = node.loc.start.offset + node.loc.source.lastIndexOf('</');
							if (!withinChangeRange({ start: { offset: start }, end: { offset: end }, source: '' })) {
								return false;
							}
						}
						for (const prop of node.props) {
							if (!tryUpdateNode(prop)) {
								return false;
							}
						}
						for (const child of node.children) {
							if (!tryUpdateNode(child)) {
								return false;
							}
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
						if (node.value && !tryUpdateNode(node.value)) {
							return false;
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.DIRECTIVE) {
						if (node.arg && !tryUpdateNode(node.arg)) {
							return false;
						}
						if (node.exp && !tryUpdateNode(node.exp)) {
							return false;
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
						if (!tryUpdateNode(node.content)) {
							return false;
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
						for (const childNode of node.children) {
							if (typeof childNode === 'object') {
								if (!tryUpdateNode(childNode as CompilerDOM.TemplateChildNode)) {
									return false;
								}
							}
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.IF) {
						for (const branche of node.branches) {
							if (branche.condition && !tryUpdateNode(branche.condition)) {
								return false;
							}
							for (const child of branche.children) {
								if (!tryUpdateNode(child)) {
									return false;
								}
							}
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.FOR) {
						for (const child of [
							node.parseResult.source,
							node.parseResult.value,
							node.parseResult.key,
							node.parseResult.index,
						]) {
							if (child && !tryUpdateNode(child)) {
								return false;
							}
						}
						for (const child of node.children) {
							if (!tryUpdateNode(child)) {
								return false;
							}
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
						if (!tryUpdateNode(node.content)) {
							return false;
						}
					}
					else if (node.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						if (withinChangeRange(node.loc) && node.isStatic) { // slot name
							return false;
						}
						node.content = node.loc.source;
					}

					return true;
				}

				return false;
			}
			function tryUpdateNodeLoc(loc: Loc) {

				if (withinChangeRange(loc)) {
					loc.source =
						loc.source.substring(0, change.start - loc.start.offset)
						+ change.newText
						+ loc.source.substring(change.end - loc.start.offset);
					loc.end.offset += lengthDiff;
					return true;
				}
				else if (change.end <= loc.start.offset) {
					loc.start.offset += lengthDiff;
					loc.end.offset += lengthDiff;
					return true;
				}
				else if (change.start >= loc.end.offset) {
					return true; // no need update
				}

				return false;
			}
			function withinChangeRange(loc: Loc) {
				return change.start >= loc.start.offset && change.end <= loc.end.offset;
			}
		},
	};
};
export = plugin;
