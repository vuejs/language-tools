import { hyphenate } from '@vue/shared';
import * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';

export async function execute(
	connection: vscode.Connection,
	{ sourceFiles }: ApiLanguageServiceContext,
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

	const virtualDoc = sourceFile.getTemplateScriptDocument();
	if (!virtualDoc)
		return;

	const edits: vscode.TextEdit[] = [];
	const components = new Set(sourceFile.getTemplateScriptData().components);
	for (const tagName of components) {
		const searchText = `__VLS_componentPropsBase['${tagName}'`;
		const index = virtualDoc.getText().indexOf(searchText);
		if (index >= 0) {
			const offset = index + searchText.length - `${tagName}'`.length;
			const references = _findReferences(virtualDoc.uri, virtualDoc.positionAt(offset));
			for (const reference of references) {
				if (
					reference.uri === sourceFile.uri
					&& document.offsetAt(reference.range.start) >= template.loc.start
					&& document.offsetAt(reference.range.end) <= template.loc.end
				) {
					const referenceText = document.getText(reference.range);
					for (const component of components) {
						if (component === referenceText || hyphenate(component) === referenceText) {
							if (mode === 'kebab' && referenceText !== hyphenate(component)) {
								edits.push(vscode.TextEdit.replace(reference.range, hyphenate(component)));
							}
							if (mode === 'pascal' && referenceText !== component) {
								edits.push(vscode.TextEdit.replace(reference.range, component));
							}
						}
					}
				}
			}
		}
	}

	connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
}
