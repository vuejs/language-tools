import type { Connection } from 'vscode-languageserver/node';
import type { Position } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import type { LanguageService as TsLanguageService } from '@volar/vscode-typescript-languageservice';
import { TextEdit } from 'vscode-languageserver/node';
import { sleep } from '@volar/shared';
import { SearchTexts } from '../utils/string';

export async function execute(
    document: TextDocument,
    sourceFile: SourceFile,
    connection: Connection,
    _findReferences: (uri: string, position: Position) => Location[],
    tsLanguageService: TsLanguageService,
) {
    const desc = sourceFile.getDescriptor();
    if (!desc.scriptSetup) return;
    const genData = sourceFile.getScriptSetupData();
    if (!genData) return;
    let edits: TextEdit[] = [];

    let varsNum = 0;
    let varsCur = 0;
    for (const label of genData.labels) {
        for (const binary of label.binarys) {
            varsNum += binary.vars.length;
        }
    }
    const progress = await connection.window.createWorkDoneProgress();
    progress.begin('Unuse Ref Sugar', 0, '', true);
    for (const label of genData.labels) {
        edits.push(TextEdit.replace({
            start: document.positionAt(desc.scriptSetup.loc.start + label.label.start),
            end: document.positionAt(desc.scriptSetup.loc.start + label.label.end + 1),
        }, 'const'));
        for (const binary of label.binarys) {
            edits.push(TextEdit.del({
                start: document.positionAt(desc.scriptSetup.loc.start + binary.parent.start),
                end: document.positionAt(desc.scriptSetup.loc.start + binary.left.start),
            }));
            edits.push(TextEdit.del({
                start: document.positionAt(desc.scriptSetup.loc.start + binary.parent.end),
                end: document.positionAt(desc.scriptSetup.loc.start + (binary.right ?? binary.left).end),
            }));
            if (!binary.right) {
                edits.push(TextEdit.insert(
                    document.positionAt(desc.scriptSetup.loc.start + binary.left.end),
                    ' = ref()'
                ));
            }
            else if (
                !binary.right.isComputedCall
                && !document.getText().substring(desc.scriptSetup.loc.start + binary.left.start, desc.scriptSetup.loc.start + binary.left.end).startsWith('{') // TODO
            ) {
                let rightType = '';
                if (binary.right.as) {
                    rightType = `<${document.getText().substring(
                        desc.scriptSetup.loc.start + binary.right.as.start,
                        desc.scriptSetup.loc.start + binary.right.as.end,
                    )}>`;
                    edits.push(TextEdit.del({
                        start: document.positionAt(desc.scriptSetup.loc.start + binary.right.withoutAs.end),
                        end: document.positionAt(desc.scriptSetup.loc.start + binary.right.as.end),
                    }));
                }
                edits.push(TextEdit.insert(
                    document.positionAt(desc.scriptSetup.loc.start + binary.right.start),
                    `ref${rightType}(`
                ));
                edits.push(TextEdit.insert(
                    document.positionAt(desc.scriptSetup.loc.start + binary.right.end),
                    ')'
                ));
            }
            for (const _var of binary.vars) {
                if (progress.token.isCancellationRequested) {
                    return;
                }
                const varRange = {
                    start: document.positionAt(desc.scriptSetup.loc.start + _var.start),
                    end: document.positionAt(desc.scriptSetup.loc.start + _var.end),
                };
                const varText = document.getText(varRange);
                progress.report(++varsCur / varsNum * 100, varText);
                await sleep(0);
                const references = _findReferences(document.uri, varRange.start) ?? [];
                for (const reference of references) {
                    if (reference.uri !== document.uri)
                        continue;
                    const refernceRange = {
                        start: document.offsetAt(reference.range.start),
                        end: document.offsetAt(reference.range.end),
                    };
                    if (refernceRange.start === desc.scriptSetup.loc.start + _var.start && refernceRange.end === desc.scriptSetup.loc.start + _var.end)
                        continue;
                    if (refernceRange.start >= desc.scriptSetup.loc.start && refernceRange.end <= desc.scriptSetup.loc.end) {
                        const referenceText = document.getText().substring(refernceRange.start, refernceRange.end);
                        const isRaw = `$${varText}` === referenceText;
                        let isShorthand = false;
                        for (const shorthandProperty of genData.shorthandPropertys) {
                            if (
                                refernceRange.start === desc.scriptSetup.loc.start + shorthandProperty.start
                                && refernceRange.end === desc.scriptSetup.loc.start + shorthandProperty.end
                            ) {
                                isShorthand = true;
                                break;
                            }
                        }
                        if (isRaw) {
                            edits.push(TextEdit.replace(reference.range, isShorthand ? `$${varText}: ${varText}` : varText));
                        }
                        else {
                            edits.push(TextEdit.replace(reference.range, isShorthand ? `${varText}: ${varText}.value` : `${varText}.value`));
                        }
                    }
                }
            }
        }
    }
    const script = sourceFile.getVirtualScript();
    if (!script.document || !script.sourceMap) return;
    const refOffset = script.document.getText().indexOf(SearchTexts.Ref);
    const items = tsLanguageService.doComplete(script.document.uri, script.document.positionAt(refOffset), { includeCompletionsForModuleExports: true });
    for (let item of items) {
        if (item.label !== 'ref')
            continue;
        item = tsLanguageService.doCompletionResolve(item);
        if (!item.data.importModule)
            continue;
        if (!item.additionalTextEdits)
            continue;
        for (const edit of item.additionalTextEdits) {
            const vueRange = script.sourceMap.getSourceRange(edit.range.start, edit.range.end);
            if (!vueRange)
                continue;
            edits.push({
                range: vueRange,
                newText: edit.newText,
            });
        }
    }
    progress.done();
    connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
}
