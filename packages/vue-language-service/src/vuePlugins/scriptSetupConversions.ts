import * as shared from '@volar/shared';
import { parseUnuseScriptSetupRanges, parseUseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupConvertRanges';
import type { TextRange } from '@volar/vue-code-gen/out/types';
import * as vscode from 'vscode-languageserver-protocol';
import { ConfigurationHost, EmbeddedLanguageServicePlugin, ExecuteCommandContext } from '@volar/vue-language-service-types';
import { VueDocument } from '../vueDocuments';

enum Commands {
    USE_SETUP_SUGAR = 'scriptSetupConversions.use',
    UNUSE_SETUP_SUGAR = 'scriptSetupConversions.unuse',
}

export interface ReferencesCodeLensData {
    uri: string,
    position: vscode.Position,
}

type CommandArgs = [string];

export default function (host: {
    configurationHost: ConfigurationHost | undefined,
    ts: typeof import('typescript/lib/tsserverlibrary'),
    getVueDocument(uri: string): VueDocument | undefined,
    doCodeActions: (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => Promise<vscode.CodeAction[] | undefined>,
    doCodeActionResolve: (item: vscode.CodeAction) => Promise<vscode.CodeAction>,
}): EmbeddedLanguageServicePlugin {

    return {

        doCodeLens(document) {
            return worker(document.uri, async (vueDocument) => {

                const isEnabled = await host.configurationHost?.getConfiguration<boolean>('volar.codeLens.scriptSetupTools') ?? true;

                if (!isEnabled)
                    return;

                const result: vscode.CodeLens[] = [];
                const descriptor = vueDocument.file.getDescriptor();

                if (descriptor.scriptSetup) {
                    result.push({
                        range: {
                            start: document.positionAt(descriptor.scriptSetup.startTagEnd),
                            end: document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
                        },
                        command: {
                            title: 'setup sugar ☑',
                            command: Commands.UNUSE_SETUP_SUGAR,
                            arguments: <CommandArgs>[document.uri],
                        },
                    });
                }
                else if (descriptor.script) {
                    result.push({
                        range: {
                            start: document.positionAt(descriptor.script.startTagEnd),
                            end: document.positionAt(descriptor.script.startTagEnd + descriptor.script.content.length),
                        },
                        command: {
                            title: 'setup sugar ☐',
                            command: Commands.USE_SETUP_SUGAR,
                            arguments: <CommandArgs>[document.uri],
                        },
                    });
                }
                return result;
            });
        },

        doExecuteCommand(command, args, context) {

            if (command === Commands.USE_SETUP_SUGAR) {

                const [uri] = args as CommandArgs;

                return worker(uri, vueDocument => {
                    return useSetupSugar(host.ts, vueDocument, context, host.doCodeActions, host.doCodeActionResolve);
                });
            }

            if (command === Commands.UNUSE_SETUP_SUGAR) {

                const [uri] = args as CommandArgs;

                return worker(uri, vueDocument => {
                    return unuseSetupSugar(host.ts, vueDocument, context, host.doCodeActions, host.doCodeActionResolve);
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

async function useSetupSugar(
    ts: typeof import('typescript/lib/tsserverlibrary'),
    vueDocument: VueDocument,
    context: ExecuteCommandContext,
    doCodeActions: (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => Promise<vscode.CodeAction[] | undefined>,
    doCodeActionResolve: (item: vscode.CodeAction) => Promise<vscode.CodeAction>,
) {

    const descriptor = vueDocument.file.getDescriptor();
    if (!descriptor.script) return;

    const scriptAst = vueDocument.file.getScriptAst();
    if (!scriptAst) return;

    const edits = await getEdits(
        vueDocument,
        descriptor.script,
        scriptAst,
    );

    if (edits?.length) {

        await context.applyEdit({ changes: { [vueDocument.file.fileName]: edits } });
        await shared.sleep(200);

        const importEdits = await getAddMissingImportsEdits(vueDocument, doCodeActions, doCodeActionResolve);
        if (importEdits) {
            await context.applyEdit(importEdits);
        }
    }

    async function getEdits(
        _vueDocument: NonNullable<typeof vueDocument>,
        _script: NonNullable<typeof descriptor['script']>,
        _scriptAst: NonNullable<typeof scriptAst>,
    ) {

        const ranges = parseUseScriptSetupRanges(ts, _scriptAst);
        const document = _vueDocument.getDocument();
        const edits: vscode.TextEdit[] = [];
        const scriptStartPos = document.positionAt(_script.startTagEnd);
        const startTagText = document.getText({
            start: {
                line: scriptStartPos.line,
                character: 0,
            },
            end: scriptStartPos,
        });

        addReplace(-1, -1, ' setup');

        const newScriptSetupCode = getScriptSetupCode();
        const newScriptCode = getScriptCode();

        addReplace(0, _script.content.length, '\n' + newScriptSetupCode + '\n');

        if (newScriptCode !== '') {
            let newScriptBlock = `${startTagText}\n${newScriptCode}\n</script>\n\n`;
            addReplace(-startTagText.length, -startTagText.length, newScriptBlock);
        }

        return edits;

        function getScriptCode() {

            let scriptBodyCode = '';
            let scriptExportCode = '';

            for (const statement of ranges.otherScriptStatements) {
                const statementRange = getStatementRange(statement);
                scriptBodyCode += _script.content.substring(statementRange.start, statementRange.end) + '\n';
            }

            if (ranges.otherOptions.length) {
                scriptExportCode += 'export default {\n';
                for (const otherOption of ranges.otherOptions) {
                    scriptExportCode += _script.content.substring(otherOption.start, otherOption.end) + ',\n';
                }
                scriptExportCode += '};\n';
            }

            return [scriptBodyCode, scriptExportCode]
                .map(code => code.trim())
                .filter(code => code !== '')
                .join('\n\n');
        }
        function getScriptSetupCode() {

            let scriptSetupImportsCode = '';
            let scriptDefinesCode = '';
            let scriptSetupBodyCode = '';

            for (const importRange of ranges.imports) {
                let importRange_2 = getStatementRange(importRange);
                scriptSetupImportsCode += _script.content.substring(importRange_2.start, importRange_2.end) + '\n';
            }

            if (ranges.propsOption) {
                if (ranges.setupOption?.props) {
                    scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.props.start, ranges.setupOption.props.end)} = `;
                }
                scriptDefinesCode += `defineProps(${_script.content.substring(ranges.propsOption.start, ranges.propsOption.end)});\n`;
            }
            if (ranges.setupOption?.context && 'start' in ranges.setupOption.context) {
                scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.context.start, ranges.setupOption.context.end)} = {\n`;
                if (ranges.emitsOption) {
                    scriptDefinesCode += `emit: defineEmits(${_script.content.substring(ranges.emitsOption.start, ranges.emitsOption.end)}),\n`
                }
                scriptDefinesCode += `slots: useSlots(),\n`
                scriptDefinesCode += `attrs: useAttrs(),\n`
                scriptDefinesCode += '};\n';
            }
            else {
                if (ranges.emitsOption) {
                    if (ranges.setupOption?.context && 'emit' in ranges.setupOption.context && ranges.setupOption.context.emit) {
                        scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.context.emit.start, ranges.setupOption.context.emit.end)} = `;
                    }
                    scriptDefinesCode += `defineEmits(${_script.content.substring(ranges.emitsOption.start, ranges.emitsOption.end)});\n`;
                }
                if (ranges.setupOption?.context && 'slots' in ranges.setupOption.context && ranges.setupOption.context.slots) {
                    scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.context.slots.start, ranges.setupOption.context.slots.end)} = useSlots();\n`;
                }
                if (ranges.setupOption?.context && 'attrs' in ranges.setupOption.context && ranges.setupOption.context.attrs) {
                    scriptDefinesCode += `const ${_script.content.substring(ranges.setupOption.context.attrs.start, ranges.setupOption.context.attrs.end)} = useAttrs();\n`;
                }
            }

            if (ranges.setupOption) {
                const bodyRange = {
                    start: ranges.setupOption.body.start + 1, // remove {
                    end: ranges.setupOption.body.end - 1, // remove }
                };
                if (ranges.setupOption.bodyReturn) {
                    const reutrnRange = getStatementRange(ranges.setupOption.bodyReturn);
                    scriptSetupBodyCode = _script.content.substring(bodyRange.start, reutrnRange.start)
                        + _script.content.substring(reutrnRange.end, bodyRange.end);
                }
                else {
                    scriptSetupBodyCode = _script.content.substring(bodyRange.start, bodyRange.end);
                }
            }

            return [scriptSetupImportsCode, scriptDefinesCode, scriptSetupBodyCode]
                .map(code => code.trim())
                .filter(code => code !== '')
                .join('\n\n');
        }
        function getStatementRange(scriptTextRange: TextRange) {
            let end = scriptTextRange.end;
            if (_script.content.substring(end, end + 1) === ';')
                end++;
            return {
                start: scriptTextRange.start,
                end,
            };
        }
        function addReplace(start: number, end: number, text: string) {
            edits.push(vscode.TextEdit.replace(
                {
                    start: document.positionAt(_script.startTagEnd + start),
                    end: document.positionAt(_script.startTagEnd + end),
                },
                text
            ));
        }
    }
}


async function unuseSetupSugar(
    ts: typeof import('typescript/lib/tsserverlibrary'),
    vueDocument: VueDocument,
    context: ExecuteCommandContext,
    doCodeActions: (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => Promise<vscode.CodeAction[] | undefined>,
    doCodeActionResolve: (item: vscode.CodeAction) => Promise<vscode.CodeAction>,
) {

    const descriptor = vueDocument.file.getDescriptor();
    if (!descriptor.scriptSetup) return;

    const scriptSetupAst = vueDocument.file.getScriptSetupAst();
    if (!scriptSetupAst) return;

    const edits = await getEdits(
        vueDocument,
        descriptor.script,
        descriptor.scriptSetup,
        vueDocument.file.getScriptAst(),
        scriptSetupAst,
    );

    if (edits?.length) {

        await context.applyEdit({ changes: { [vueDocument.uri]: edits } });
        await shared.sleep(200);

        const importEdits = await getAddMissingImportsEdits(vueDocument);
        if (importEdits) {
            await context.applyEdit(importEdits);
        }
    }


    async function getAddMissingImportsEdits(
        _vueDocument: NonNullable<typeof vueDocument>,
    ) {

        const document = _vueDocument.getDocument();
        const codeActions = await doCodeActions(document.uri, {
            start: document.positionAt(0),
            end: document.positionAt(document.getText().length),
        }, {
            diagnostics: [],
            only: [`${vscode.CodeActionKind.Source}.addMissingImports.ts`],
        }) ?? [];

        for (const codeAction of codeActions) {
            const newCodeAction = await doCodeActionResolve(codeAction);
            if (newCodeAction.edit) {
                return newCodeAction.edit;
            }
        }
    }
    async function getEdits(
        _vueDocument: NonNullable<typeof vueDocument>,
        _script: typeof descriptor['script'],
        _scriptSetup: NonNullable<typeof descriptor['scriptSetup']>,
        _scriptAst: typeof scriptSetupAst,
        _scriptSetupAst: NonNullable<typeof scriptSetupAst>,
    ) {

        const ranges = parseUnuseScriptSetupRanges(ts, _scriptSetupAst);
        const scriptRanges = _scriptAst ? parseUseScriptSetupRanges(ts, _scriptAst) : undefined;

        const document = _vueDocument.getDocument();
        const edits: vscode.TextEdit[] = [];
        const removeSetupTextRanges: TextRange[] = [...ranges.imports];

        const sfcCode = document.getText();
        const setupAttr = sfcCode.substring(0, _scriptSetup.startTagEnd).lastIndexOf(' setup');

        edits.push(vscode.TextEdit.replace(
            {
                start: document.positionAt(setupAttr),
                end: document.positionAt(setupAttr + ' setup'.length),
            },
            ''
        ));

        if (_script) {
            edits.push(vscode.TextEdit.replace(
                {
                    start: document.positionAt(_script.start),
                    end: document.positionAt(_script.end),
                },
                ''
            ));
        }

        if (ranges.defineProps) {
            removeSetupTextRanges.push(ranges.defineProps.range);
        }
        if (ranges.defineEmits) {
            removeSetupTextRanges.push(ranges.defineEmits.range);
        }
        if (ranges.useSlots) {
            removeSetupTextRanges.push(ranges.useSlots.range);
        }
        if (ranges.useAttrs) {
            removeSetupTextRanges.push(ranges.useAttrs.range);
        }

        let newScriptCode = '';

        for (const setupImport of ranges.imports) {
            newScriptCode += _scriptSetup.content.substring(setupImport.start, setupImport.end);
            newScriptCode += '\n';
        }

        if (_script) {
            if (scriptRanges?.exportDefault) {

                let scriptCodeWithoutExport =
                    _script.content.substring(0, scriptRanges.exportDefault.start).trim() + '\n'
                    + _script.content.substring(scriptRanges.exportDefault.end).trim();
                scriptCodeWithoutExport = scriptCodeWithoutExport.trim();

                if (scriptCodeWithoutExport) {
                    newScriptCode += '\n' + scriptCodeWithoutExport + '\n';
                }
            }
            else {
                newScriptCode += _script.content;
            }
        }

        newScriptCode += '\n';
        newScriptCode += 'export default defineComponent({\n';

        if (scriptRanges && _script) {
            for (const otherOption of scriptRanges.otherOptions) {
                newScriptCode += _script.content.substring(otherOption.start, otherOption.end) + ',\n';
            }
        }

        if (ranges.defineProps && 'args' in ranges.defineProps) {
            newScriptCode += 'props: ';
            newScriptCode += _scriptSetup.content.substring(ranges.defineProps.args.start, ranges.defineProps.args.end);
            newScriptCode += ',\n';
        }

        if (ranges.defineProps && 'typeArgs' in ranges.defineProps) {
            newScriptCode += 'props: {\n';
            for (const typeProp of ranges.defineProps.typeArgs) {
                const nameString = _scriptSetup.content.substring(typeProp.name.start, typeProp.name.end);
                const typeString = getTypeObject(typeProp.type);
                if (!typeProp.required && !typeProp.default) {
                    newScriptCode += `${nameString}: ${typeString},\n`;
                }
                else {
                    newScriptCode += `${nameString}: {\n`;
                    newScriptCode += `type: ${typeString},\n`;
                    if (typeProp.required) {
                        newScriptCode += `required: true,\n`;
                    }
                    if (typeProp.default) {
                        newScriptCode += `default: ${_scriptSetup.content.substring(typeProp.default.start, typeProp.default.end)},\n`;
                    }
                    newScriptCode += '},\n';
                }
            }
            newScriptCode += '},\n';
        }

        if (ranges.defineEmits && 'args' in ranges.defineEmits) {
            newScriptCode += 'emits: ';
            newScriptCode += _scriptSetup.content.substring(ranges.defineEmits.args.start, ranges.defineEmits.args.end);
            newScriptCode += ',\n';
        }

        if (ranges.defineEmits && 'typeArgs' in ranges.defineEmits) {
            newScriptCode += 'emits: {\n';
            for (const typeProp of ranges.defineEmits.typeArgs) {
                const nameString = _scriptSetup.content.substring(typeProp.name.start, typeProp.name.end);
                newScriptCode += `${nameString}: (`;
                if (typeProp.restArgs) {
                    newScriptCode += _scriptSetup.content.substring(typeProp.restArgs.start, typeProp.restArgs.end);
                }
                newScriptCode += `) => true,\n`;
            }
            newScriptCode += '},\n';
        }

        {
            newScriptCode += 'setup(';

            let addedProps = false;

            if (ranges.defineProps?.binding) {
                newScriptCode += _scriptSetup.content.substring(ranges.defineProps.binding.start, ranges.defineProps.binding.end);
                addedProps = true;
            }

            const contextProps: string[] = [];

            if (ranges.defineEmits?.binding) {
                contextProps.push(getContextPropText(ranges.defineEmits.binding, 'emit'));
            }
            if (ranges.useSlots?.binding) {
                contextProps.push(getContextPropText(ranges.useSlots.binding, 'slots'));
            }
            if (ranges.useAttrs?.binding) {
                contextProps.push(getContextPropText(ranges.useAttrs.binding, 'attrs'));
            }

            if (contextProps.length) {
                tryAddProps();
                newScriptCode += ', { ';
                newScriptCode += contextProps.join(', ');
                newScriptCode += ' }';
            }

            newScriptCode += ') {\n';
            newScriptCode += getSetupOptionCode();
            newScriptCode += '\n';
            newScriptCode += 'return {\n';
            for (const binding of ranges.bindings) {
                newScriptCode += _scriptSetup.content.substring(binding.start, binding.end) + ',\n';
            }
            newScriptCode += '};\n';
            newScriptCode += '},\n';

            function tryAddProps() {
                if (!addedProps) {
                    newScriptCode += '_props';
                    addedProps = true;
                }
            }
            function getContextPropText(textSetupRange: TextRange, defaultName: string) {
                const text = _scriptSetup.content.substring(textSetupRange.start, textSetupRange.end);
                if (text !== defaultName) {
                    return `${defaultName}: ${text}`;
                }
                else {
                    return text;
                }
            }
        }

        newScriptCode += '});\n';

        addReplace(0, _scriptSetup.content.length, '\n' + newScriptCode.trim() + '\n');

        return edits;

        function getSetupOptionCode() {
            let text = _scriptSetup.content;
            for (const range of removeSetupTextRanges.sort((a, b) => b.start - a.start)) {
                let end = range.end;
                if (text.substring(end, end + 1) === ';')
                    end++;
                text = text.substring(0, range.start) + text.substring(end);
            }
            return text.trim();
        }
        function getTypeObject(typeSetupRange: TextRange) {

            const typeText = _scriptSetup.content.substring(typeSetupRange.start, typeSetupRange.end);

            switch (typeText) {
                case 'Function': return 'Function';
                case 'string': return 'String';
                case 'boolean': return 'Boolean';
                case 'number': return 'Number';
                case 'object': return 'Object';
            }

            if (typeText.endsWith(']'))
                return `Array as PropType<${typeText}>`;

            if (typeText.endsWith('}'))
                return `Object as PropType<${typeText}>`;

            return `null as any as PropType<${typeText}>`;
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

export async function getAddMissingImportsEdits(
    _vueDocument: VueDocument,
    doCodeActions: (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => Promise<vscode.CodeAction[] | undefined>,
    doCodeActionResolve: (item: vscode.CodeAction) => Promise<vscode.CodeAction>,
) {

    const document = _vueDocument.getDocument();
    const codeActions = await doCodeActions(document.uri, {
        start: document.positionAt(0),
        end: document.positionAt(document.getText().length),
    }, {
        diagnostics: [],
        only: [`${vscode.CodeActionKind.Source}.addMissingImports.ts`],
    }) ?? [];

    for (const codeAction of codeActions) {
        const newCodeAction = await doCodeActionResolve(codeAction);
        if (newCodeAction.edit) {
            return newCodeAction.edit;
        }
    }
}
