import type { LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import { SourceScript, VirtualCode, VueCodeInformation, VueVirtualCode } from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-codelens-references',
		create(context): LanguageServicePluginInstance {
			return {
				provideReferencesCodeLensRanges(document) {

					return worker(document.uri, virtualCode => {

						const result: vscode.Range[] = [];

						for (const map of context.documents.getMaps(virtualCode) ?? []) {
							for (const mapping of map.map.mappings) {

								if (!(mapping.data as VueCodeInformation).__referencesCodeLens) {
									continue;
								}

								result.push({
									start: document.positionAt(mapping.generatedOffsets[0]),
									end: document.positionAt(
										mapping.generatedOffsets[mapping.generatedOffsets.length - 1]
										+ mapping.lengths[mapping.lengths.length - 1]
									),
								});
							}
						}

						return result;
					});
				},
			};

			function worker<T>(uri: string, callback: (vueFile: VirtualCode, sourceScript: SourceScript) => T) {

				const decoded = context.decodeEmbeddedDocumentUri(uri);
				const sourceScript = decoded && context.language.scripts.get(decoded[0]);
				const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
				if (!virtualCode || !(sourceScript?.generated?.root instanceof VueVirtualCode) || !sourceScript) {
					return;
				}

				return callback(virtualCode, sourceScript);
			}
		},
	};
}
