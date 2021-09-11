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
			const tsRefs = templateTsLs.findReferences(virtualDoc.uri, virtualDoc.positionAt(offset));

			for (const tsLoc_2 of tsRefs) {
				for (const vueLoc of sourceFiles.fromTsLocation('template', tsLoc_2.uri, tsLoc_2.range.start, tsLoc_2.range.end)) {

					if (vueLoc.type === 'embedded-ts' && !vueLoc.range.data.capabilities.references)
						continue;

					if (vueLoc.type === 'source-ts')
						continue;

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
	}

	connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
}
