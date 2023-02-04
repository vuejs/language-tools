import { LanguageServicePlugin } from '@volar/language-service';
import { VueFile } from '@volar/vue-language-core';
import * as vscode from 'vscode-languageserver-protocol';

export default function (): LanguageServicePlugin {

	return (context) => {

		return {

			referencesCodeLens: {

				on(document) {

					return worker(document.uri, async () => {

						const result: vscode.Location[] = [];

						for (const [_, map] of context.documents.getMapsBySourceFileUri(document.uri)?.maps ?? []) {
							for (const mapping of map.map.mappings) {

								if (!mapping.data.referencesCodeLens)
									continue;

								result.push({
									uri: document.uri,
									range: {
										start: document.positionAt(mapping.sourceRange[0]),
										end: document.positionAt(mapping.sourceRange[1]),
									},
								});
							}
						}

						return result;
					});
				},

				async resolve(document, codeLens, references) {

					await worker(document.uri, async (vueFile) => {

						const document = context.documents.getDocumentByFileName(vueFile.snapshot, vueFile.fileName);
						const offset = document.offsetAt(codeLens.range.start);
						const blocks = [
							vueFile.sfc.script,
							vueFile.sfc.scriptSetup,
							vueFile.sfc.template,
							...vueFile.sfc.styles,
							...vueFile.sfc.customBlocks,
						];
						const sourceBlock = blocks.find(block => block && offset >= block.startTagEnd && offset <= block.endTagStart);
						references = references.filter(reference =>
							reference.uri !== document.uri // different file
							|| sourceBlock !== blocks.find(block => block && document.offsetAt(reference.range.start) >= block.startTagEnd && document.offsetAt(reference.range.end) <= block.endTagStart) // different block
						);
					});

					return references;
				},
			},
		};

		function worker<T>(uri: string, callback: (vueSourceFile: VueFile) => T) {

			const [virtualFile] = context.documents.getVirtualFileByUri(uri);
			if (!(virtualFile instanceof VueFile))
				return;

			return callback(virtualFile);
		}
	};
}
