import type { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import { SourceFile, VirtualCode, VueCodeInformation, VueGeneratedCode } from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';

export function create(): ServicePlugin {
	return {
		name: 'vue-codelens-references',
		create(context): ServicePluginInstance {
			return {
				provideReferencesCodeLensRanges(document) {

					return worker(document.uri, virtualCode => {

						const result: vscode.Range[] = [];

						for (const map of context.documents.getMaps(virtualCode) ?? []) {
							for (const mapping of map.map.mappings) {

								if (!(mapping.data as VueCodeInformation).__referencesCodeLens)
									continue;

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

			function worker<T>(uri: string, callback: (vueFile: VirtualCode, sourceFile: SourceFile) => T) {

				const [virtualCode, sourceFile] = context.documents.getVirtualCodeByUri(uri);
				if (!(sourceFile?.generated?.code instanceof VueGeneratedCode) || !sourceFile)
					return;

				return callback(virtualCode, sourceFile);
			}
		},
	};
}
