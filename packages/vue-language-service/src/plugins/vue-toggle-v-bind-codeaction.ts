import { LanguageServicePlugin } from '@volar/language-service';
import { VueFile } from '@volar/vue-language-core';
import { AttributeNode, NodeTypes } from 'packages/vue-language-core/src/utils/vue2TemplateCompiler';

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
				type Children = typeof templateAst.children;

				const templateStartOffset = template!.startTagEnd;
				function find(children: Children): Children[number] | AttributeNode | void {
					for (const child of children) {
						const {
							start: { offset: start },
							end: { offset: end },
						} = child.loc;
						if (startOffset >= start + templateStartOffset && endOffset <= end + templateStartOffset) {
							const children = child.type === NodeTypes.ELEMENT ? [...child.props, ...child.children] : 'children' in child && typeof child.children === 'object' && Array.isArray(child.children) && child.children;
							if (children) {
								return find(children as typeof child & any[]) ?? child;
							} else {
								return child;
							}
						}
					}
				}
				const templateNode = find(templateAst.children);
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
