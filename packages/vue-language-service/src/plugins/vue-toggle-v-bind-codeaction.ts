import { LanguageServicePlugin } from '@volar/language-service';
import { VueFile } from '@volar/vue-language-core';
import { AttributeNode, NodeTypes, RootNode } from 'packages/vue-language-core/src/utils/vue2TemplateCompiler';

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
				const templateNode = findTemplateNode(templateAst.children, startOffset - templateStartOffset, endOffset - templateStartOffset);
				const propInterpolationStart = [':', 'v-', '@'];
				if (
					templateNode &&
					templateNode.type === NodeTypes.ATTRIBUTE &&
					(!templateNode.value || propInterpolationStart.every(start => !templateNode.value!.content.startsWith(start)))
				) {
					const addVBindPos = document.positionAt(templateStartOffset + templateNode.loc.start.offset);
					return [{
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
					}];
				}

				return [];
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
