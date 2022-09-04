import { VueLanguagePlugin } from '../sourceFile';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from '../utils/vue2TemplateCompiler';

interface Loc {
	start: { offset: number; };
	end: { offset: number; };
	source: string;
}
interface ElementNameNode {
	type: 'self-closeing-tag-name';
	loc: Loc;
};
type Node = CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.ExpressionNode | CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode | ElementNameNode;

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {

	return {

		compileSFCTemplate(lang, template, options) {

			if (lang === 'html') {

				const compiler = vueCompilerOptions.target < 3 ? CompilerVue2 : CompilerDOM;

				return compiler.compile(template, {
					...options,
					...vueCompilerOptions.experimentalTemplateCompilerOptions,
				});
			}
		},

		updateSFCTemplate(oldResult, change) {

			const lengthDiff = change.newText.length - (change.end - change.start);
			let hitNodes: Node[] = [];

			if (tryUpdateNode(oldResult.ast) && hitNodes.length) {
				hitNodes = hitNodes.sort((a, b) => a.loc.source.length - b.loc.source.length);
				const hitNode = hitNodes[0];
				if (
					hitNode.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					|| hitNode.type === 'self-closeing-tag-name'
				) {
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
						if (node.isSelfClosing) {
							const elementNameNode: ElementNameNode = {
								type: 'self-closeing-tag-name',
								loc: {
									start: { offset: node.loc.start.offset + 1 },
									end: { offset: node.loc.start.offset + 1 + node.tag.length },
									source: node.tag,
								},
							};
							const oldTagType = getTagType(node.tag);
							if (!tryUpdateNode(elementNameNode)) {
								return false;
							}
							node.tag = elementNameNode.loc.source;
							const newTagType = getTagType(node.tag);
							if (newTagType !== oldTagType) {
								return false;
							}
						}
						else {
							if (withinChangeRange(node.loc)) {
								// if not self closing, should not hit tag name
								const start = node.loc.start.offset + 2;
								const end = node.loc.start.offset + node.loc.source.lastIndexOf('</');
								if (!withinChangeRange({ start: { offset: start }, end: { offset: end }, source: '' })) {
									return false;
								}
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
						if (node.isStatic) { // slot name
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

function getTagType(tag: string) {
	if (tag === 'slot' || tag === 'template') {
		return tag;
	}
	else {
		return 'element';
	}
}
