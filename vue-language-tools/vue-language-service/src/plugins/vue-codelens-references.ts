import * as vscode from 'vscode-languageserver-protocol';
import { LanguageServicePlugin, LanguageServicePluginContext, DocumentsAndSourceMaps } from '@volar/language-service';
import { VueFile } from '@volar/vue-language-core';

const showReferencesCommand = 'volar.show-references';

export const commands = [showReferencesCommand];

type CommandArgs = [string, vscode.Position, vscode.Location[]];

export interface ReferencesCodeLensData {
	uri: string,
	position: vscode.Position,
}

export default function (options: {
	documents: DocumentsAndSourceMaps,
	findReference(uri: string, position: vscode.Position): Promise<vscode.Location[] | undefined>,
}): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		codeLens: {

			on(document) {
				return worker(document.uri, async (vueFile) => {

					const isEnabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.codeLens.references') ?? true;

					if (!isEnabled)
						return;

					const result: vscode.CodeLens[] = [];

					for (const [_, map] of options.documents.getMapsByVirtualFileName(vueFile.fileName)) {
						for (const mapping of map.map.mappings) {

							if (!mapping.data.referencesCodeLens)
								continue;

							result.push({
								range: {
									start: document.positionAt(mapping.sourceRange[0]),
									end: document.positionAt(mapping.sourceRange[1]),
								},
								data: {
									uri: document.uri,
									position: document.positionAt(mapping.sourceRange[0]),
								} satisfies ReferencesCodeLensData,
							});
						}
					}

					return result;
				});
			},

			async resolve(codeLens) {

				const data: ReferencesCodeLensData = codeLens.data;

				await worker(data.uri, async (vueFile) => {

					const document = options.documents.getDocumentByFileName(vueFile.snapshot, vueFile.fileName);
					const offset = document.offsetAt(data.position);
					const blocks = [
						vueFile.sfc.script,
						vueFile.sfc.scriptSetup,
						vueFile.sfc.template,
						...vueFile.sfc.styles,
						...vueFile.sfc.customBlocks,
					];
					const allRefs = await options.findReference(data.uri, data.position) ?? [];
					const sourceBlock = blocks.find(block => block && offset >= block.startTagEnd && offset <= block.endTagStart);
					const diffDocRefs = allRefs.filter(reference =>
						reference.uri !== data.uri // different file
						|| sourceBlock !== blocks.find(block => block && document.offsetAt(reference.range.start) >= block.startTagEnd && document.offsetAt(reference.range.end) <= block.endTagStart) // different block
					);

					codeLens.command = {
						title: diffDocRefs.length === 1 ? '1 reference' : `${diffDocRefs.length} references`,
						command: showReferencesCommand,
						arguments: <CommandArgs>[data.uri, codeLens.range.start, diffDocRefs],
					};
				});

				return codeLens;
			},
		},

		doExecuteCommand(command, args, context) {

			if (command === showReferencesCommand) {

				const [uri, position, references] = args as CommandArgs;

				context.showReferences({
					textDocument: { uri },
					position,
					references,
				});
			}
		},
	};

	function worker<T>(uri: string, callback: (vueSourceFile: VueFile) => T) {

		const virtualFile = options.documents.getVirtualFileByUri(uri);
		if (!(virtualFile instanceof VueFile))
			return;

		return callback(virtualFile);
	}
}
