import { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import { VueFile, eachElementNode, type CompilerDOM } from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';

export function create(ts: typeof import('typescript/lib/tsserverlibrary')): ServicePlugin {
	return {
		create(context): ServicePluginInstance {
			return {
				provideCodeActions(document, range, _context) {

					const startOffset = document.offsetAt(range.start);
					const endOffset = document.offsetAt(range.end);
					const [virtualFile] = context.language.files.getVirtualFile(document.uri);

					if (!(virtualFile instanceof VueFile)) {
						return;
					}

					const { template } = virtualFile.sfc;

					if (!template?.ast) return;

					const templateStartOffset = template!.startTagEnd;
					const result: vscode.CodeAction[] = [];

					for (const node of eachElementNode(template.ast)) {
						if (startOffset > templateStartOffset + node.loc.end.offset || endOffset < templateStartOffset + node.loc.start.offset) {
							return;
						}
						for (const prop of node.props) {
							if (
								startOffset - templateStartOffset >= prop.loc.start.offset
								&& endOffset - templateStartOffset <= prop.loc.end.offset
							) {
								if (prop.type === 7 satisfies CompilerDOM.NodeTypes.DIRECTIVE && prop.exp) {

									const sourceFile = ts.createSourceFile('/a.ts', prop.exp.loc.source, ts.ScriptTarget.Latest, true);
									const firstStatement = sourceFile.statements[0];

									if (sourceFile.statements.length === 1 && ts.isExpressionStatement(firstStatement) && ts.isStringLiteralLike(firstStatement.expression)) {
										const stringNode = sourceFile.statements[0];
										const removeTextRanges: [number, number][] = [
											[prop.loc.start.offset, prop.loc.start.offset + 1],
											// Work correctly with trivias for cases like <input :type=" 'password' " />
											[prop.exp.loc.start.offset, prop.exp.loc.start.offset + stringNode.pos + stringNode.getLeadingTriviaWidth() + 1],
											[prop.exp.loc.start.offset + stringNode.end - 1, prop.exp.loc.end.offset],
										];
										result.push({
											title: 'Remove v-bind from attribute',
											kind: 'refactor.rewrite.removeVBind',
											edit: {
												changes: {
													[document.uri]: removeTextRanges.map(range => ({
														newText: '',
														range: {
															start: document.positionAt(templateStartOffset + range[0]),
															end: document.positionAt(templateStartOffset + range[1]),
														}
													}))
												},
											},
										});
									}
								}
								if (prop.type === 6 satisfies CompilerDOM.NodeTypes.ATTRIBUTE) {

									const edits: vscode.TextEdit[] = [];
									const addVBindPos = document.positionAt(templateStartOffset + prop.loc.start.offset);
									edits.push({
										newText: ':',
										range: {
											start: addVBindPos,
											end: addVBindPos,
										},
									});

									let newPosition: vscode.Position | undefined;

									if (prop.value) {
										const valueStart = document.positionAt(templateStartOffset + prop.value.loc.start.offset);
										const valueEnd = document.positionAt(templateStartOffset + prop.value.loc.end.offset);

										if (prop.value.loc.end.offset - prop.value.loc.start.offset !== prop.value.content.length) {
											valueStart.character++;
											valueEnd.character--;
										}

										edits.push({
											newText: "'",
											range: {
												start: valueStart,
												end: valueStart,
											},
										});
										edits.push({
											newText: "'",
											range: {
												start: valueEnd,
												end: valueEnd,
											},
										});
									}
									else {
										const addValuePos = document.positionAt(templateStartOffset + prop.loc.end.offset);

										newPosition = {
											line: addValuePos.line,
											character: addValuePos.character + ':'.length + '="'.length,
										};

										edits.push({
											newText: '=""',
											range: {
												start: addValuePos,
												end: addValuePos
											},
										});
									}

									result.push({
										title: 'Add v-bind to attribute',
										kind: 'refactor.rewrite.addVBind',
										edit: {
											changes: { [document.uri]: edits },
										},
										command: newPosition ? context?.commands.setSelection.create(newPosition) : undefined,
									});
								}
							}
						}
					}

					return result;
				},

				transformCodeAction(item) {
					return item; // ignore mapping
				},
			};
		},
	};
}
