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

					addDefineCompletionItem(
						scriptSetupRanges.defineProps?.statement,
						scriptSetupRanges.withDefaults?.exp ?? scriptSetupRanges.defineProps?.exp,
						'props'
					);
					addDefineCompletionItem(
						scriptSetupRanges.defineEmits?.statement,
						scriptSetupRanges.defineEmits?.exp,
						'emit'
					);
					addDefineCompletionItem(
						scriptSetupRanges.defineSlots?.statement,
						scriptSetupRanges.defineSlots?.exp,
						'slots'
					);

					return {
						isIncomplete: false,
						items: result
					};

					function addDefineCompletionItem(
						statement: TextRange | undefined,
						exp: TextRange | undefined,
						name: string
					) {
						if (!exp || exp.start !== statement?.start) {
							return;
						}

						let offset;
						for (const [, map] of mappings) {
							for (const [generatedOffset] of map.toGeneratedLocation(scriptSetup!.startTagEnd + exp.start)) {
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