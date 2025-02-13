import type { CompletionItem, LanguageServicePlugin } from '@volar/language-service';
import type * as vscode from 'vscode-languageserver-protocol';

const cmds = [
	['vue-ignore'],
	['vue-skip'],
	['vue-expect-error'],
	['vue-generic', 'vue-generic {$1}'],
];

const directiveCommentReg = /<!--\s*@/;

/**
 * A language service plugin that provides completion for Vue directive comments,
 * e.g. if user is writing `<!-- |` in they'll be provided completions for `@vue-expect-error`, `@vue-generic`, etc.
 */
export function create(): LanguageServicePlugin {
	return {
		name: 'vue-directive-comments',
		capabilities: {
			completionProvider: {
				triggerCharacters: ['@'],
			},
		},
		create() {
			return {
				provideCompletionItems(document, position) {

					if (document.languageId !== 'html') {
						return;
					}

					const line = document.getText({ start: { line: position.line, character: 0 }, end: position });
					const cmdStart = line.match(directiveCommentReg);
					if (!cmdStart) {
						return;
					}

					const startIndex = cmdStart.index! + cmdStart[0].length;
					const remainText = line.slice(startIndex);
					const result: CompletionItem[] = [];

					for (const [label, text = label] of cmds) {
						let match = true;
						for (let i = 0; i < remainText.length; i++) {
							if (remainText[i] !== label[i]) {
								match = false;
								break;
							}
						}
						if (match) {
							result.push({
								label: '@' + label,
								textEdit: {
									range: {
										start: {
											line: position.line,
											character: startIndex - 1,
										},
										end: position,
									},
									newText: '@' + text,
								},
								insertTextFormat: 2 satisfies typeof vscode.InsertTextFormat.Snippet
							});
						}
					}

					return {
						isIncomplete: false,
						items: result,
					};
				},
			};
		},
	};
}
