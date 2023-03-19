import { LanguageServicePlugin } from '@volar/language-service';
import { VueFile, walkElementNodes } from '@volar/vue-language-core';
import { NodeTypes } from 'packages/vue-language-core/src/utils/vue2TemplateCompiler';
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
							&& startOffset - templateStartOffset >= prop.loc.start.offset
							&& endOffset - templateStartOffset <= prop.loc.end.offset
						) {
							const addVBindPos = document.positionAt(templateStartOffset + prop.loc.start.offset);
							let addValueEdit: vscode.TextEdit | undefined;
							if (!prop.value) {
								const addValuePos = document.positionAt(templateStartOffset + prop.loc.end.offset);
								addValueEdit = {
									newText: '=""',
									range: {
										start: addValuePos,
										end: addValuePos
									},
								};
							}
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
										}, ...addValueEdit ? [addValueEdit] : []]
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
