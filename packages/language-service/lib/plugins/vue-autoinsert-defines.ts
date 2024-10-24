import type { LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import * as vscode from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { TextRange, tsCodegen, VueVirtualCode } from '@vue/language-core';
import { isTsDocument } from './vue-autoinsert-dotvalue';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-autoinsert-defines',
		capabilities: {
			completionProvider: {
				triggerCharacters: ['\\w']
			}
		},
		create(context): LanguageServicePluginInstance {
			return {
				async provideCompletionItems(document) {
					if (!isTsDocument(document)) {
						return;
					}

					const uri = URI.parse(document.uri);
					const result: vscode.CompletionItem[] = [];
					const decoded = context.decodeEmbeddedDocumentUri(uri);
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

					addDefineCompletionItem(scriptSetupRanges.props.define, 'props');
					addDefineCompletionItem(scriptSetupRanges.emits.define, 'emit');
					addDefineCompletionItem(scriptSetupRanges.slots.define, 'slots');

					return {
						isIncomplete: false,
						items: result
					};

					function addDefineCompletionItem(
						define: {
							exp: TextRange,
							statement: TextRange
						} | undefined,
						name: string
					) {
						if (!define || define.exp.start !== define.statement?.start) {
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
							kind: vscode.CompletionItemKind.Variable,
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