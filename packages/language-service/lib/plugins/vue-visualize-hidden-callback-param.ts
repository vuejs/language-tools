import type { LanguageServicePluginInstance } from '@volar/language-service';
import type * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServicePlugin, VueCodeInformation } from '../types';
import { URI } from 'vscode-uri';

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

					if (vitualCode) {

						const start = document.offsetAt(range.start);
						const end = document.offsetAt(range.end);

						for (const mapping of vitualCode.mappings) {

							const hint = (mapping.data as VueCodeInformation).__hint;

							if (
								mapping.generatedOffsets[0] >= start
								&& mapping.generatedOffsets[mapping.generatedOffsets.length - 1] + mapping.lengths[mapping.lengths.length - 1] <= end
								&& hint
							) {

								settings[hint.setting] ??= await context.env.getConfiguration?.<boolean>(hint.setting) ?? false;

								if (!settings[hint.setting]) {
									continue;
								}

								result.push({
									label: hint.label,
									paddingRight: hint.paddingRight,
									paddingLeft: hint.paddingLeft,
									position: document.positionAt(mapping.generatedOffsets[0]),
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
