import { hyphenate } from '@vue/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection, Location, Position } from 'vscode-languageserver/node';
import { TextEdit } from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFile';

export async function execute(
    document: TextDocument,
    sourceFile: SourceFile,
    connection: Connection,
    _findReferences: (uri: string, position: Position) => Location[],
    mode: 'kebab' | 'pascal',
) {

    const desc = sourceFile.getDescriptor();
    if (!desc.template) return;

    const template = desc.template;

    const virtualDoc = sourceFile.getTsDocuments().get(sourceFile.uri + '.__VLS_template.ts');
    if (!virtualDoc) return;

    const edits: TextEdit[] = [];
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
                                edits.push(TextEdit.replace(reference.range, hyphenate(component)));
                            }
                            if (mode === 'pascal' && referenceText !== component) {
                                edits.push(TextEdit.replace(reference.range, component));
                            }
                        }
                    }
                }
            }
        }
    }

    connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
}
