import * as shared from '@volar/shared';
import * as ts2 from '@volar/typescript-language-service';
import { parseDeclarationRanges, parseDotValueRanges } from '@volar/vue-code-gen/out/parsers/refSugarRanges';
import * as vscode from 'vscode-languageserver-protocol';
import { margeWorkspaceEdits } from '../languageFuatures/rename';
import { EmbeddedLanguagePlugin, ExecuteCommandContext } from '@volar/vue-language-service-types';
import { isBlacklistNode, isRefType } from './autoCompleteRefs';
import { getAddMissingImportsEdits } from './scriptSetupConversions';
import { VueDocument } from '../vueDocuments';

enum Commands {
    USE_REF_SUGAR = 'refSugarConversions.use',
    UNUSE_REF_SUGAR = 'refSugarConversions.unuse',
}

export interface ReferencesCodeLensData {
    uri: string,
    position: vscode.Position,
}

type CommandArgs = [string];

export default function (host: {
    getSettings: <S>(section: string, scopeUri?: string | undefined) => Promise<S | undefined>,
    getVueDocument(uri: string): VueDocument | undefined,
    // for use ref sugar
    ts: typeof import('typescript/lib/tsserverlibrary'),
    findReferences: (uri: string, position: vscode.Position) => Promise<vscode.Location[] | undefined>,
    findTypeDefinition: (uri: string, position: vscode.Position) => Promise<vscode.LocationLink[] | undefined>,
    scriptTsLs: ts2.LanguageService,
    // for unuse ref sugar
    doCodeActions: (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => Promise<vscode.CodeAction[] | undefined>,
    doCodeActionResolve: (item: vscode.CodeAction) => Promise<vscode.CodeAction>,
    doRename: (uri: string, position: vscode.Position, newName: string) => Promise<vscode.WorkspaceEdit | undefined>,
    doValidation: (uri: string) => Promise<vscode.Diagnostic[] | undefined>,
}): EmbeddedLanguagePlugin {

    return {

        doCodeLens(document) {
            return worker(document.uri, async (vueDocument) => {

                const isEnabled = await host.getSettings<boolean>('volar.codeLens.scriptSetupTools') ?? true;

                if (!isEnabled)
                    return;

                const result: vscode.CodeLens[] = [];
                const descriptor = vueDocument.file.getDescriptor();
                const ranges = vueDocument.file.getSfcRefSugarRanges();

                if (descriptor.scriptSetup && ranges) {
                    result.push({
                        range: {
                            start: document.positionAt(descriptor.scriptSetup.startTagEnd),
                            end: document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
                        },
                        command: {
                            title: 'ref sugar ' + (ranges.refs.length ? '☑' : '☐'),
                            command: ranges.refs.length ? Commands.UNUSE_REF_SUGAR : Commands.USE_REF_SUGAR,
                            arguments: [document.uri],
                        },
                    });
                }

                return result;
            });
        },

        doExecuteCommand(command, args, context) {

            if (command === Commands.USE_REF_SUGAR) {

                const [uri] = args as CommandArgs;

                return worker(uri, vueDocument => {
                    return useRefSugar(host.ts, vueDocument, context, host.findReferences, host.findTypeDefinition, host.scriptTsLs);
                });
            }

            if (command === Commands.UNUSE_REF_SUGAR) {

                const [uri] = args as CommandArgs;

                return worker(uri, vueDocument => {
                    return unuseRefSugar(vueDocument, context, host.doCodeActions, host.doCodeActionResolve, host.doRename, host.doValidation);
                });
            }
        },
    };

    function worker<T>(uri: string, callback: (vueDocument: VueDocument) => T) {

        const vueDocument = host.getVueDocument(uri);
        if (!vueDocument)
            return;

        return callback(vueDocument);
    }
}

async function useRefSugar(
    ts: typeof import('typescript/lib/tsserverlibrary'),
    vueDocument: VueDocument,
    context: ExecuteCommandContext,
    findReferences: (uri: string, position: vscode.Position) => Promise<vscode.Location[] | undefined>,
    findTypeDefinition: (uri: string, position: vscode.Position) => Promise<vscode.LocationLink[] | undefined>,
    scriptTsLs: ts2.LanguageService,
) {

    const descriptor = vueDocument.file.getDescriptor();
    if (!descriptor.scriptSetup) return;

    const scriptSetupAst = vueDocument.file.getScriptSetupAst();
    if (!scriptSetupAst) return;

    context.workDoneProgress.begin('Unuse Ref Sugar', 0, '', true);

    const edits = await getUseRefSugarEdits(vueDocument, descriptor.scriptSetup, scriptSetupAst);

    if (context.token.isCancellationRequested)
        return;

    if (edits?.length) {
        await context.applyEdit({ changes: { [vueDocument.uri]: edits } });
    }

    context.workDoneProgress.done();

    async function getUseRefSugarEdits(
        _vueDocument: VueDocument,
        _scriptSetup: NonNullable<typeof descriptor['scriptSetup']>,
        _scriptSetupAst: NonNullable<typeof scriptSetupAst>,
    ) {

        const ranges = parseDeclarationRanges(ts, _scriptSetupAst);
        const dotValueRanges = parseDotValueRanges(ts, _scriptSetupAst);
        const document = _vueDocument.getDocument();
        const edits: vscode.TextEdit[] = [];

        for (const declaration of ranges) {

            let isRefDeclaration = false;

            for (const binding of declaration.leftBindings) {

                const definitions = await findTypeDefinition(document.uri, document.positionAt(_scriptSetup.startTagEnd + binding.end)) ?? [];
                const _isRefType = isRefType(definitions, scriptTsLs);

                if (!_isRefType)
                    continue;

                isRefDeclaration = true;

                let references = await findReferences(document.uri, document.positionAt(_scriptSetup.startTagEnd + binding.end)) ?? [];

                references = references.filter(reference => {

                    if (reference.uri !== document.uri)
                        return false;

                    const start = document.offsetAt(reference.range.start);
                    const end = document.offsetAt(reference.range.end);

                    if (start >= (_scriptSetup.startTagEnd + binding.start) && end <= (_scriptSetup.startTagEnd + binding.end))
                        return false;

                    if (end < _scriptSetup.startTagEnd || start > _scriptSetup.startTagEnd + _scriptSetup.content.length)
                        return false;

                    if (isBlacklistNode(ts, _scriptSetupAst, start - _scriptSetup.startTagEnd))
                        return false;

                    return true;
                });

                for (const reference of references) {

                    const sfcStart = document.offsetAt(reference.range.start);
                    const sfcEnd = document.offsetAt(reference.range.end);
                    const setupStart = sfcStart - _scriptSetup.startTagEnd;
                    const setupEnd = sfcEnd - _scriptSetup.startTagEnd;
                    const dotValue = dotValueRanges.find(dot => dot.beforeDot === setupEnd);

                    if (!dotValue) {
                        addReplace(setupStart, setupStart, '$raw(');
                        addReplace(setupEnd, setupEnd, ')');
                    }
                    else {
                        addReplace(dotValue.beforeDot, dotValue.range.end, '');
                    }
                }
            }

            if (isRefDeclaration) {
                if (!declaration.leftIsIdentifier) {
                    addReplace(declaration.right.start, declaration.right.start, '$fromRefs(');
                    addReplace(declaration.right.end, declaration.right.end, ')');
                }
                else if (declaration.rightFn) {
                    const fnText = _scriptSetup.content.substring(declaration.rightFn.start, declaration.rightFn.end);
                    if (['ref', 'shallowRef'].includes(fnText)) {
                        addReplace(declaration.flag.start, declaration.flag.end, 'let');
                    }
                    if (['ref', 'computed', 'shallowRef'].includes(fnText)) {
                        addReplace(declaration.right.start, declaration.right.start, '$');
                    }
                }
                else {
                    addReplace(declaration.right.start, declaration.right.start, '$ref(');
                    addReplace(declaration.right.end, declaration.right.end, ')');
                }
            }
        }

        return edits;

        function addReplace(start: number, end: number, text: string) {

            if (_scriptSetup.content.substring(start, end) === text)
                return;

            edits.push(vscode.TextEdit.replace(
                {
                    start: document.positionAt(_scriptSetup.startTagEnd + start),
                    end: document.positionAt(_scriptSetup.startTagEnd + end),
                },
                text
            ));
        }
    }
}

async function unuseRefSugar(
    vueDocument: VueDocument,
    context: ExecuteCommandContext,
    doCodeActions: (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => Promise<vscode.CodeAction[] | undefined>,
    doCodeActionResolve: (item: vscode.CodeAction) => Promise<vscode.CodeAction>,
    doRename: (uri: string, position: vscode.Position, newName: string) => Promise<vscode.WorkspaceEdit | undefined>,
    doValidation: (uri: string) => Promise<vscode.Diagnostic[] | undefined>,
) {

    const descriptor = vueDocument.file.getDescriptor();
    if (!descriptor.scriptSetup) return;

    const scriptSetupAst = vueDocument.file.getScriptSetupAst();
    if (!scriptSetupAst) return;

    context.workDoneProgress.begin('Unuse Ref Sugar', 0, '', true);

    const edits = await getUnRefSugarEdits(vueDocument, descriptor.scriptSetup, scriptSetupAst);

    if (context.token.isCancellationRequested)
        return;

    if (edits?.length) {

        await context.applyEdit({ changes: { [vueDocument.uri]: edits } });
        await shared.sleep(200);

        const errors = await doValidation(vueDocument.uri) ?? [];
        const importEdits = await getAddMissingImportsEdits(vueDocument, doCodeActions, doCodeActionResolve);
        const removeInvalidValueEdits = getRemoveInvalidDotValueEdits(vueDocument, errors);

        if (importEdits && removeInvalidValueEdits) {
            margeWorkspaceEdits(importEdits, removeInvalidValueEdits);
            await context.applyEdit(importEdits);
        }
        else if (importEdits || removeInvalidValueEdits) {
            await context.applyEdit((importEdits ?? removeInvalidValueEdits)!);
        }
    }

    context.workDoneProgress.done();

    function getRemoveInvalidDotValueEdits(
        _vueDocument: VueDocument,
        errors: vscode.Diagnostic[],
    ) {

        const document = _vueDocument.getDocument();
        const edits: vscode.TextEdit[] = [];

        for (const error of errors) {
            const errorText = document.getText(error.range);
            if (error.code === 2339 && errorText === 'value') {
                edits.push(vscode.TextEdit.del({
                    start: {
                        line: error.range.start.line,
                        character: error.range.start.character - 1,
                    },
                    end: error.range.end,
                }));
            }
        }

        if (!edits.length)
            return;

        const result: vscode.WorkspaceEdit = { documentChanges: [vscode.TextDocumentEdit.create(vscode.OptionalVersionedTextDocumentIdentifier.create(document.uri, document.version), edits)] };
        return result;
    }
    async function getUnRefSugarEdits(
        _vueDocument: VueDocument,
        _scriptSetup: NonNullable<typeof descriptor['scriptSetup']>,
        _scriptSetupAst: NonNullable<typeof scriptSetupAst>,
    ) {

        const ranges = _vueDocument.file.getSfcRefSugarRanges();
        const document = _vueDocument.getDocument();
        const edits: vscode.TextEdit[] = [];

        if (!ranges)
            return;

        let varsNum = 0;
        let varsCur = 0;

        for (const callRange of ranges.refs) {
            varsNum += callRange.leftBindings.length;
        }

        for (const callRange of ranges.refs) {

            addReplace(callRange.flag.start, callRange.flag.end, 'const');

            const fnName = _scriptSetup.content.substring(callRange.rightFn.start, callRange.rightFn.end);

            if (fnName === '$fromRefs') {

            }
            else {
                const newFnName = fnName.substring(1); // $ref -> ref
                addReplace(callRange.rightFn.start, callRange.rightFn.end, newFnName);
            }


            for (const binding of callRange.leftBindings) {

                if (context.token.isCancellationRequested)
                    return;

                const varText = _scriptSetup.content.substring(binding.start, binding.end);
                context.workDoneProgress.report(++varsCur / varsNum * 100, varText);
                await shared.sleep(0);

                const bindingName = _scriptSetup.content.substring(binding.start, binding.end);
                const renames = await doRename(_vueDocument.uri, document.positionAt(_scriptSetup.startTagEnd + binding.end), bindingName + '.value');

                if (renames?.changes) {
                    const edits_2 = renames.changes[_vueDocument.uri];
                    if (edits_2) {
                        for (const edit of edits_2) {

                            const editRange = {
                                start: document.offsetAt(edit.range.start),
                                end: document.offsetAt(edit.range.end),
                            };

                            if (editRange.start >= (_scriptSetup.startTagEnd + binding.start) && editRange.end <= (_scriptSetup.startTagEnd + binding.end))
                                continue;

                            if (editRange.end < _scriptSetup.startTagEnd || editRange.start > _scriptSetup.startTagEnd + _scriptSetup.content.length)
                                continue;

                            if (inRawCall(editRange.start, editRange.end))
                                continue;

                            edits.push(edit);
                        }
                    }
                }
            }
        }

        for (const rawCall of ranges.raws) {
            addReplace(rawCall.fullRange.start, rawCall.argsRange.start, '');
            addReplace(rawCall.argsRange.end, rawCall.fullRange.end, '');
        }

        return edits;

        function inRawCall(start: number, end: number) {
            if (ranges) {
                for (const rawRange of ranges.raws) {
                    if (start >= (_scriptSetup.startTagEnd + rawRange.argsRange.start) && end <= (_scriptSetup.startTagEnd + rawRange.argsRange.end)) {
                        return true;
                    }
                }
            }
            return false;
        }
        function addReplace(start: number, end: number, text: string) {

            if (_scriptSetup.content.substring(start, end) === text)
                return;

            edits.push(vscode.TextEdit.replace(
                {
                    start: document.positionAt(_scriptSetup.startTagEnd + start),
                    end: document.positionAt(_scriptSetup.startTagEnd + end),
                },
                text
            ));
        }
    }
}
