import { LanguageServicePlugin } from '@volar/language-service';
import { VueFile, walkElementNodes } from '@volar/vue-language-core';
import { AttributeNode, NodeTypes, RootNode } from 'packages/vue-language-core/src/utils/vue2TemplateCompiler';
import type * as vscode from 'vscode-languageserver-protocol';

export default function (): LanguageServicePlugin {
	return (ctx) => {

		return {

			provideCodeActions(document, range, _context) {
				const startOffset = document.offsetAt(range.start);
				const endOffset = document.offsetAt(range.end);

				const [vueFile] = ctx!.documents.getVirtualFileByUri(document.uri);
				if (!vueFile || !(vueFile instanceof VueFile)) {
					return;
				}

				const { templateAst, template } = vueFile.sfc;

				if (!templateAst) return;

				const templateStartOffset = template!.startTagEnd;
				const result: vscode.CodeAction[] = [];

				walkElementNodes(templateAst, node => {
					for (const prop of node.props) {
						if (
							prop.type === NodeTypes.ATTRIBUTE
							&& prop.value
							&& startOffset - templateStartOffset >= prop.loc.start.offset
							&& endOffset - templateStartOffset <= prop.loc.end.offset
						) {
							console.log('in');
							const addVBindPos = document.positionAt(templateStartOffset + prop.loc.start.offset);
							result.push({
								title: 'Add v-bind to attribute',
								kind: 'refactor.rewrite.addVBind',
								edit: {
									changes: {
										[document.uri]: [{
											newText: ':',
											range: {
												start: addVBindPos,
												end: addVBindPos
											},
										}]
									},
								},
							});
						}
					}
				});

				return result;
			}
		};
	};
}

type Children = RootNode['children'];

function getNodeChildren(node: Children[number]) {
	switch (node.type) {
		case NodeTypes.ELEMENT:
			return [...node.props, ...node.children];
		case NodeTypes.ELEMENT:
		case NodeTypes.IF_BRANCH:
		case NodeTypes.FOR:
			return node.children;
		case NodeTypes.IF:
			return node.branches;
	}
}

export function findTemplateNode(children: Children, startOffset: number, endOffset: number): Children[number] | AttributeNode | void {
	for (const child of children) {
		const {
			start: { offset: start },
			end: { offset: end },
		} = child.loc;
		if (startOffset >= start && endOffset <= end) {
			const children = getNodeChildren(child);
			if (children) {
				return findTemplateNode(children as typeof child & any[], startOffset, endOffset) ?? child;
			} else {
				return child;
			}
		}
	}
}
