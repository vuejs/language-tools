import { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import { SourceFile, VirtualFile, VueCodeInformation, VueFile } from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';

export function create(): ServicePlugin {
	return {
		create(context): ServicePluginInstance {
			return {
				provideReferencesCodeLensRanges(document) {

					return worker(document.uri, async virtualFile => {

						const result: vscode.Range[] = [];

						for (const map of context.documents.getMaps(virtualFile) ?? []) {
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

				async resolveReferencesCodeLensLocations(document, range, references) {

					const [virtualFile, sourceFile] = context.language.files.getVirtualFile(context.env.uriToFileName(document.uri));
					if (virtualFile && sourceFile?.virtualFile?.[0] instanceof VueFile) {
						const vueFile = sourceFile.virtualFile[0];
						const blocks = [
							vueFile.sfc.script,
							vueFile.sfc.scriptSetup,
							vueFile.sfc.template,
							...vueFile.sfc.styles,
							...vueFile.sfc.customBlocks,
						];
						for (const map of context.documents.getMaps(virtualFile)) {
							const sourceOffset = map.map.getSourceOffset(document.offsetAt(range.start));
							if (sourceOffset !== undefined) {
								const sourceBlock = blocks.find(block => block && sourceOffset[0] >= block.startTagEnd && sourceOffset[0] <= block.endTagStart);
								const sourceDocument = context.documents.get(context.env.fileNameToUri(sourceFile.fileName), sourceFile.languageId, sourceFile.snapshot);
								references = references.filter(reference =>
									reference.uri !== sourceDocument.uri // different file
									|| sourceBlock !== blocks.find(block =>
										block
										&& sourceDocument.offsetAt(reference.range.start) >= block.startTagEnd
										&& sourceDocument.offsetAt(reference.range.end) <= block.endTagStart
									) // different block
								);
								break;
							}
						}
					}

					return references;
				},
			};

			function worker<T>(uri: string, callback: (vueFile: VirtualFile, sourceFile: SourceFile) => T) {

				const [virtualFile, sourceFile] = context.language.files.getVirtualFile(context.env.uriToFileName(uri));
				if (!(sourceFile?.virtualFile?.[0] instanceof VueFile) || !sourceFile)
					return;

				return callback(virtualFile, sourceFile);
			}
		},
	};
}
