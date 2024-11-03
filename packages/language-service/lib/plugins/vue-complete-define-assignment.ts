import type { LanguageServicePlugin } from '@volar/language-service';
import { TextRange, tsCodegen, VueVirtualCode } from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { isTsDocument } from './vue-autoinsert-dotvalue';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-complete-define-assignment',
		capabilities: {
			completionProvider: {},
		},
		create(context) {
			return {
				isAdditionalCompletion: true,
				async provideCompletionItems(document) {
					if (!isTsDocument(document)) {
						return;
					}

					const enabled = await context.env.getConfiguration?.<boolean>('vue.complete.defineAssignment') ?? true;
					if (!enabled) {
						return;
					}

					const result: vscode.CompletionItem[] = [];
					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!sourceScript || !virtualCode) {
						return;
					}

					const root = sourceScript?.generated?.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const codegen = tsCodegen.get(root._sfc);
					const scriptSetup = root._sfc.scriptSetup;
					const scriptSetupRanges = codegen?.scriptSetupRanges.get();
					if (!scriptSetup || !scriptSetupRanges) {
						return;
					}

					const mappings = [...context.language.maps.forEach(virtualCode)];

					addDefineCompletionItem(scriptSetupRanges.props.define && {
						exp: scriptSetupRanges.props.withDefaults ?? scriptSetupRanges.props.define.exp,
						statement: scriptSetupRanges.props.define.statement
					}, 'props');
					addDefineCompletionItem(scriptSetupRanges.emits.define, 'emit');
					addDefineCompletionItem(scriptSetupRanges.slots.define, 'slots');

					return {
						isIncomplete: false,
						items: result
					};

					function addDefineCompletionItem(
						define: {
							exp: TextRange,
							statement: TextRange;
						} | undefined,
						name: string
					) {
						if (!define || define.exp.start !== define.statement.start) {
							return;
						}

						let offset;
						for (const [, map] of mappings) {
							for (const [generatedOffset] of map.toGeneratedLocation(scriptSetup!.startTagEnd + define.exp.start)) {
								offset = generatedOffset;
								break;
							}
						}
						if (offset === undefined) {
							return;
						}

						const pos = document.positionAt(offset);
						result.push({
							label: name,
							kind: 6 satisfies typeof vscode.CompletionItemKind.Variable,
							commitCharacters: ['.', ',', ';'],
							additionalTextEdits: [{
								newText: `const ${name} = `,
								range: {
									start: pos,
									end: pos
								}
							}]
						});
					}
				},
			};
		},
	};
}