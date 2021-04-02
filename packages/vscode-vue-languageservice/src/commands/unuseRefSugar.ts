import type { Connection } from 'vscode-languageserver/node';
import type { Position } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import { TextEdit } from 'vscode-languageserver/node';
import { sleep } from '@volar/shared';
import { parse2 } from '../parsers/scriptSetupAst';

export async function execute(
    ts: typeof import('typescript'),
    document: TextDocument,
    sourceFile: SourceFile,
    connection: Connection,
    _findReferences: (uri: string, position: Position) => Location[],
) {

    const desc = sourceFile.getDescriptor();
    if (!desc.scriptSetup) return;

    const genData = sourceFile.getScriptSetupData();
    if (!genData) return;

    const descriptor = sourceFile.getDescriptor();
    if (!descriptor.scriptSetup) return;

    const genData2 = parse2(ts, descriptor.scriptSetup.content);

    let edits: TextEdit[] = [];
    let varsNum = 0;
    let varsCur = 0;
    for (const label of genData2.refCalls) {
        varsNum += label.vars.length;
    }
    const progress = await connection.window.createWorkDoneProgress();
    progress.begin('Use Ref Sugar', 0, '', true);
    for (const refCall of genData2.refCalls) {

        const left = document.getText().substring(
            desc.scriptSetup.loc.start + refCall.left.start,
            desc.scriptSetup.loc.start + refCall.left.end,
        );
        const rightExp = refCall.rightExpression
            ? document.getText().substring(
                desc.scriptSetup.loc.start + refCall.rightExpression.start,
                desc.scriptSetup.loc.start + refCall.rightExpression.end,
            )
            : undefined;
        const rightType = refCall.rightType
            ? document.getText().substring(
                desc.scriptSetup.loc.start + refCall.rightType.start,
                desc.scriptSetup.loc.start + refCall.rightType.end,
            )
            : undefined;
        let right = '';
        if (rightExp && rightType) {
            right = ' = ' + rightExp + ' as ' + rightType;
        }
        else if (rightExp) {
            right = ' = ' + rightExp;
        }
        else if (rightType) {
            right = ' = undefined as ' + rightType + ' | undefined';
        }

        if (left.trim().startsWith('{')) {
            edits.push(TextEdit.replace({
                start: document.positionAt(desc.scriptSetup.loc.start + refCall.start),
                end: document.positionAt(desc.scriptSetup.loc.start + refCall.end),
            }, `ref: (${left}${right})`));
        }
        else {
            edits.push(TextEdit.replace({
                start: document.positionAt(desc.scriptSetup.loc.start + refCall.start),
                end: document.positionAt(desc.scriptSetup.loc.start + refCall.end),
            }, `ref: ${left}${right}`));
        }
        for (const _var of refCall.vars) {
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
                    const withDotValue = document.getText().substr(refernceRange.end, '.value'.length) === '.value';
                    if (withDotValue) {
                        edits.push(TextEdit.replace({
                            start: reference.range.start,
                            end: document.positionAt(refernceRange.end + '.value'.length),
                        }, varText));
                    }
                    else {
                        edits.push(TextEdit.replace(reference.range, '$' + varText));
                    }
                }
            }
        }
    }
    progress.done();
    connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
}
