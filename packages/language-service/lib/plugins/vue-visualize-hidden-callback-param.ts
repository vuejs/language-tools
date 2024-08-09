import type { LanguageServicePluginInstance } from '@volar/language-service';
import { tsCodegen, VueVirtualCode } from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import type { LanguageServicePlugin } from '../types';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-inlay-hints-hidden-callback-param',
		capabilities: {
			inlayHintProvider: {},
		},
		create(context): LanguageServicePluginInstance {
			return {
				async provideInlayHints(document, range) {

					const settings: Record<string, boolean> = {};
					const result: vscode.InlayHint[] = [];
					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const vitualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);

					if (vitualCode instanceof VueVirtualCode) {

						const codegen = tsCodegen.get(vitualCode.sfc);
						const inlayHints = [
							...codegen?.generatedTemplate()?.inlayHints ?? [],
							...codegen?.generatedScript()?.inlayHints ?? [],
						];
						const blocks = [
							vitualCode.sfc.template,
							vitualCode.sfc.script,
							vitualCode.sfc.scriptSetup,
						];
						const start = document.offsetAt(range.start);
						const end = document.offsetAt(range.end);

						for (const hint of inlayHints) {

							const block = blocks.find(block => block?.name === hint.blockName);
							const hintOffset = (block?.startTagEnd ?? 0) + hint.offset;

							if (hintOffset >= start && hintOffset <= end) {

								settings[hint.setting] ??= await context.env.getConfiguration?.<boolean>(hint.setting) ?? false;

								if (!settings[hint.setting]) {
									continue;
								}

								result.push({
									label: hint.label,
									paddingRight: hint.paddingRight,
									paddingLeft: hint.paddingLeft,
									position: document.positionAt(hintOffset),
									kind: 2 satisfies typeof vscode.InlayHintKind.Parameter,
									tooltip: {
										kind: 'markdown',
										value: hint.tooltip,
									},
								});
							}
						}
					}
					return result;
				},
			};
		},
	};
}
