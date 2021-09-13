import { hyphenate } from '@vue/shared';
import * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';

export async function execute(
	connection: vscode.Connection,
	{ sourceFiles, templateTsLs }: ApiLanguageServiceContext,
	uri: string,
	_findReferences: (uri: string, position: vscode.Position) => vscode.Location[],
	mode: 'kebab' | 'pascal',
) {

	const sourceFile = sourceFiles.get(uri);
	if (!sourceFile)
		return;

	const desc = sourceFile.getDescriptor();
	if (!desc.template)
		return;

	const template = desc.template;
	const document = sourceFile.getTextDocument();
	const edits: vscode.TextEdit[] = [];
	const components = new Set(sourceFile.getTemplateScriptData().components);
	const resolvedTags = sourceFile.refs.sfcTemplateScript.templateCodeGens.value?.tagNames ?? {};

	for (const tagName of components) {
		const resolvedTag = resolvedTags[tagName];
		if (resolvedTag?.offsets.length > 0) {

			const offset = template.startTagEnd + resolvedTag.offsets[0];
			const refs = _findReferences(uri, sourceFile.getTextDocument().positionAt(offset));

			for (const vueLoc of refs) {
				if (
					vueLoc.uri === sourceFile.uri
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

	connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
}
