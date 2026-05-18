import type { CompletionItem, CompletionItemKind, LanguageServicePlugin } from '@volar/language-service';
import { type TextRange, tsCodegen } from '@vue/language-core';
import { resolveEmbeddedCode } from '../utils';

export function create(ts: typeof import('typescript')): LanguageServicePlugin {
	return {
		name: 'vue-suggest-define-assignment',
		capabilities: {
			completionProvider: {},
		},
		create(context) {
			return {
				isAdditionalCompletion: true,
				async provideCompletionItems(document, position) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (!info?.code.id.startsWith('script_')) {
						return;
					}

					const enabled = await context.env.getConfiguration<boolean>?.('vue.suggest.defineAssignment') ?? true;
					if (!enabled) {
						return;
					}
					const { ir } = info.root;
					const codegen = tsCodegen.get(ir);
					const scriptSetup = ir.scriptSetup;
					const scriptSetupRanges = codegen?.getScriptSetupRanges();
					if (!scriptSetup || !scriptSetupRanges) {
						return;
					}

					const map = context.language.maps.get(info.code, info.script);

					let sourceOffset: number | undefined;
					for (const [offset] of map.toSourceLocation(document.offsetAt(position))) {
						sourceOffset = offset;
						break;
					}
					if (sourceOffset === undefined) {
						return;
					}

					const node = (ts as any).getTouchingPropertyName(
						scriptSetup.ast,
						sourceOffset - scriptSetup.startTagEnd,
					);
					if (ts.isStringLiteralLike(node)) {
						return;
					}

					const result: CompletionItem[] = [];

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

						let generatedOffset;
						for (const [offset] of map.toGeneratedLocation(scriptSetup!.startTagEnd + exp.start)) {
							generatedOffset = offset;
							break;
						}
						if (generatedOffset === undefined) {
							return;
						}

						const pos = document.positionAt(generatedOffset);
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
