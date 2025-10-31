import type { CompletionItem, CompletionItemKind, LanguageServicePlugin } from '@volar/language-service';
import { type TextRange, tsCodegen } from '@vue/language-core';
import { resolveEmbeddedCode } from '../utils';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-suggest-define-assignment',
		capabilities: {
			completionProvider: {},
		},
		create(context) {
			return {
				isAdditionalCompletion: true,
				async provideCompletionItems(document) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (!info?.code.id.startsWith('script_')) {
						return;
					}

					const enabled = await context.env.getConfiguration<boolean>?.('vue.suggest.defineAssignment') ?? true;
					if (!enabled) {
						return;
					}

					const { sfc } = info.root;
					const codegen = tsCodegen.get(sfc);
					const scriptSetup = sfc.scriptSetup;
					const scriptSetupRanges = codegen?.getScriptSetupRanges();
					if (!scriptSetup || !scriptSetupRanges) {
						return;
					}

					const result: CompletionItem[] = [];
					const mappings = [...context.language.maps.forEach(info.code)];

					addDefineCompletionItem(
						scriptSetupRanges.defineProps?.statement,
						scriptSetupRanges.withDefaults?.exp ?? scriptSetupRanges.defineProps?.exp,
						'props',
					);
					addDefineCompletionItem(
						scriptSetupRanges.defineEmits?.statement,
						scriptSetupRanges.defineEmits?.exp,
						'emit',
					);
					addDefineCompletionItem(
						scriptSetupRanges.defineSlots?.statement,
						scriptSetupRanges.defineSlots?.exp,
						'slots',
					);

					return {
						isIncomplete: false,
						items: result,
					};

					function addDefineCompletionItem(
						statement: TextRange | undefined,
						exp: TextRange | undefined,
						name: string,
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
							kind: 6 satisfies typeof CompletionItemKind.Variable,
							commitCharacters: ['.', ',', ';'],
							additionalTextEdits: [{
								newText: `const ${name} = `,
								range: {
									start: pos,
									end: pos,
								},
							}],
						});
					}
				},
			};
		},
	};
}
