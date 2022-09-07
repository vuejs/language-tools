import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguageServicePlugin } from '@volar/embedded-language-service';
import { hyphenate } from '@vue/shared';
import { VueDocument } from '../vueDocuments';

export const convertTagNameCasingCommand = 'tagNameCasingConversions';

export type ConvertTagNameCasingCommandArgs = [
	string, // uri
	'kebab' | 'pascal'
];

export default function (options: {
	getVueDocument(uri: string): VueDocument | undefined,
	findReferences: (uri: string, position: vscode.Position) => Promise<vscode.Location[] | undefined>,
}): EmbeddedLanguageServicePlugin {

	return {

		async doExecuteCommand(command, args, context) {

			if (command === convertTagNameCasingCommand) {

				const [uri, mode] = args as ConvertTagNameCasingCommandArgs;

				return worker(uri, async vueDocument => {

					const desc = vueDocument.file.sfc;
					if (!desc.template)
						return;

					context.workDoneProgress.begin('Convert Tag Name', 0, '', true);

					const template = desc.template;
					const document = vueDocument.getDocument();
					const edits: vscode.TextEdit[] = [];
					const components = new Set((await vueDocument.getTemplateData()).components);
					const tagOffsets = vueDocument.getTemplateTagsAndAttrs().tags;
					let i = 0;

					for (const [tagName, offsets] of tagOffsets) {
						if (offsets.length) {

							if (context.token.isCancellationRequested)
								return;

							context.workDoneProgress.report(i++ / Object.keys(tagOffsets).length * 100, tagName);

							const offset = template.startTagEnd + offsets[0];
							const refs = await options.findReferences(uri, vueDocument.getDocument().positionAt(offset)) ?? [];

							for (const vueLoc of refs) {
								if (
									vueLoc.uri === vueDocument.uri
									&& document.offsetAt(vueLoc.range.start) >= template.startTagEnd
									&& document.offsetAt(vueLoc.range.end) <= template.startTagEnd + template.content.length
								) {
									const referenceText = document.getText(vueLoc.range);
									for (const component of components) {
										if (component === referenceText || hyphenate(component) === referenceText) {
											if (mode === 'kebab' && referenceText !== hyphenate(component)) {
												edits.push(vscode.TextEdit.replace(vueLoc.range, hyphenate(component)));
											}
											if (mode === 'pascal' && referenceText !== component) {
												edits.push(vscode.TextEdit.replace(vueLoc.range, component));
											}
										}
									}
								}
							}
						}
					}

					context.applyEdit({ changes: { [document.uri]: edits } });
					context.workDoneProgress.done();
				});
			}
		},
	};

	function worker<T>(uri: string, callback: (vueDocument: VueDocument) => T) {

		const vueDocument = options.getVueDocument(uri);
		if (!vueDocument)
			return;

		return callback(vueDocument);
	}
}
