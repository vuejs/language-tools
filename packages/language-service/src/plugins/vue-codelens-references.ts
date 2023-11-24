import { Service } from '@volar/language-service';
import { MappingKey, SourceFile, VueCodeInformation, VueFile } from '@vue/language-core';
import type * as vscode from 'vscode-languageserver-protocol';

export const create = function (): Service {

	return (context): ReturnType<Service> => {

		if (!context)
			return {};

		return {

			provideReferencesCodeLensRanges(document) {

				return worker(document.uri, async (vueFile) => {

					const result: vscode.Range[] = [];

					for (const map of context.documents.getMaps(vueFile) ?? []) {
						for (const mapping of map.map.codeMappings) {

							if (!(mapping[MappingKey.DATA] as VueCodeInformation).__referencesCodeLens)
								continue;

							result.push({
								start: document.positionAt(mapping[MappingKey.SOURCE_CODE_RANGE][0]),
								end: document.positionAt(mapping[MappingKey.SOURCE_CODE_RANGE][1]),
							});
						}
					}

					return result;
				});
			},

			async resolveReferencesCodeLensLocations(document, range, references) {

				await worker(document.uri, async (vueFile) => {

					const document = context.documents.get(vueFile.id, vueFile.languageId, vueFile.snapshot);
					const offset = document.offsetAt(range.start);
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
		};

		function worker<T>(uri: string, callback: (vueFile: VueFile, sourceFile: SourceFile) => T) {

			const [virtualFile, sourceFile] = context!.project.fileProvider.getVirtualFile(uri);
			if (!(virtualFile instanceof VueFile) || !sourceFile)
				return;

			return callback(virtualFile, sourceFile);
		}
	};
};
