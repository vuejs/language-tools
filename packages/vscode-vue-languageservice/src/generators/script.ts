import type { Ast as ScriptAst } from '../parsers/scriptAst';
import type { Ast as ScriptSetupAst } from '../parsers/scriptSetupAst';
import * as SourceMaps from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';
import { replaceToComment } from '../utils/string';

export function generate(
    script: null | {
        src?: string,
        content: string,
    },
    scriptSetup: null | {
        content: string,
    },
    scriptAst: ScriptAst | undefined,
    scriptSetupAst: ScriptSetupAst | undefined,
) {

    const gen = SourceMaps.createScriptGenerator<SourceMaps.TsMappingData>();
    const teleports: SourceMaps.Mapping<SourceMaps.TeleportMappingData>[] = [];

    if (script?.src) {
        writeScriptSrc();
    }
    else {
        writeScript();
        writeScriptSetup();
        writeExportOptions();
    }

    return {
        code: gen.getText(),
        mappings: gen.getMappings(),
        teleports,
    };

    function writeScriptSrc() {
        if (!script?.src)
            return;

        gen.addText(`export * from `);
        gen.addCode(
            `'${script.src}'`,
            { start: -1, end: -1 },
            SourceMaps.Mode.Offset,
            {
                vueTag: 'scriptSrc',
                capabilities: {
                    basic: true,
                    references: true,
                    definitions: true,
                    rename: true,
                    diagnostic: true,
                    formatting: true,
                    completion: true,
                    semanticTokens: true,
                    foldingRanges: true,
                },
            }
        );
        gen.addText(`;\n`);
        gen.addText(`export { default } from '${script.src}';\n`);
    }
    function writeScript() {
        if (!script)
            return;

        let addText = script.content;
        if (scriptSetup && scriptAst?.exportDefault) {
            addText = replaceToComment(script.content, scriptAst.exportDefault.start, scriptAst.exportDefault.end);
        }
        gen.addCode(
            addText,
            { start: 0, end: script.content.length },
            SourceMaps.Mode.Offset,
            {
                vueTag: 'script',
                capabilities: {
                    basic: true,
                    references: true,
                    definitions: true,
                    rename: true,
                    diagnostic: true,
                    formatting: true,
                    completion: true,
                    semanticTokens: true,
                    foldingRanges: true,
                },
            }
        );
    }
    function writeScriptSetup() {
        if (!scriptSetup)
            return;
        if (!scriptSetupAst)
            return;

        const data = scriptSetupAst;
        const originalCode = scriptSetup.content;
        let sourceCode = scriptSetup.content;
        gen.addText(`\n/* <script setup> */\n`);
        let newLinesOnly = originalCode.split('\n').map(line => ' '.repeat(line.length)).join('\n');
        let importPos = 0;
        for (const _import of data.imports.sort((a, b) => a.start - b.start)) {
            gen.addCode(
                newLinesOnly.substring(importPos, _import.start),
                { start: importPos, end: _import.start },
                SourceMaps.Mode.Offset,
                { // for auto import
                    vueTag: 'scriptSetup',
                    capabilities: {},
                },
            );
            gen.addCode(
                originalCode.substring(_import.start, _import.end),
                { start: _import.start, end: _import.end },
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {
                        basic: true,
                        references: true,
                        definitions: true,
                        rename: true,
                        semanticTokens: true,
                        completion: true,
                        diagnostic: true,
                    },
                },
            );
            sourceCode = replaceToComment(sourceCode, _import.start, _import.end);
            importPos = _import.end;
        }
        gen.addCode(
            newLinesOnly.substring(importPos, newLinesOnly.length),
            { start: importPos, end: newLinesOnly.length },
            SourceMaps.Mode.Offset,
            { // for auto import
                vueTag: 'scriptSetup',
                capabilities: {},
            },
        );

        gen.addText(`\n`);
        gen.addText(`export default (await import('__VLS_vue')).__VLS_defineComponent({\n`);
        if (data.defineProps?.typeArgs) {
            gen.addText(`props: ({} as __VLS_DefinePropsToOptions<`);
            gen.addCode(
                originalCode.substring(data.defineProps.typeArgs.start, data.defineProps.typeArgs.end),
                {
                    start: data.defineProps.typeArgs.start,
                    end: data.defineProps.typeArgs.end,
                },
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {},
                },
            );
            gen.addText(`>),\n`);
        }
        if (data.defineEmit?.typeArgs) {
            gen.addText(`emits: ({} as __VLS_ConstructorOverloads<`);
            gen.addCode(
                originalCode.substring(data.defineEmit.typeArgs.start, data.defineEmit.typeArgs.end),
                {
                    start: data.defineEmit.typeArgs.start,
                    end: data.defineEmit.typeArgs.end,
                },
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {},
                },
            );
            gen.addText(`>),\n`);
        }
        if (data.defineProps?.args) {
            gen.addText(`props: `);
            gen.addCode(
                originalCode.substring(data.defineProps.args.start, data.defineProps.args.end),
                {
                    start: data.defineProps.args.start,
                    end: data.defineProps.args.end,
                },
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {
                        basic: true,
                        references: true,
                        definitions: true,
                        diagnostic: true,
                        rename: true,
                        completion: true,
                        semanticTokens: true,
                    },
                },
            );
            gen.addText(`,\n`);
        }
        if (data.defineEmit?.args) {
            gen.addText(`emits: `);
            gen.addCode(
                originalCode.substring(data.defineEmit.args.start, data.defineEmit.args.end),
                {
                    start: data.defineEmit.args.start,
                    end: data.defineEmit.args.end,
                },
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {
                        basic: true,
                        references: true,
                        definitions: true,
                        diagnostic: true,
                        rename: true,
                        completion: true,
                        semanticTokens: true,
                    },
                },
            );
            gen.addText(`,\n`);
        }
        gen.addText(`async `);
        gen.addCode(
            'setup',
            {
                start: 0,
                end: 0,
            },
            SourceMaps.Mode.Totally,
            {
                vueTag: 'scriptSetup',
                capabilities: {},
            });
        gen.addText(`() {\n`);

        const labels = data.labels.sort((a, b) => a.start - b.start);
        let tsOffset = 0;
        for (const label of labels) {
            mapSubText(tsOffset, label.start);
            let first = true;

            gen.addText(`{ `);
            for (const binary of label.binarys) {
                if (first) {
                    first = false;
                    gen.addText(`let `);
                }
                else {
                    gen.addText(`, `);
                }
                for (const v of binary.vars) {
                    (v as any)['teleportRange'] = {
                        start: gen.getText().length + v.start - binary.left.start,
                        end: gen.getText().length + v.end - binary.left.start,
                    };
                }
                gen.addCode(
                    originalCode.substring(binary.left.start, binary.left.end),
                    binary.left,
                    SourceMaps.Mode.Offset,
                    {
                        vueTag: 'scriptSetup',
                        capabilities: {
                            completion: true,
                            definitions: true,
                            references: true,
                            semanticTokens: true,
                            rename: true,
                        },
                    },
                );
                if (binary.right) {
                    gen.addText(` = `);
                    gen.addText(originalCode.substring(binary.right.start, binary.right.end));
                }
            }
            gen.addText(`; }\n`);

            first = true;
            for (const binary of label.binarys) {
                if (first) {
                    first = false;
                    gen.addText(`const `);
                }
                else {
                    gen.addText(`, `);
                }

                let leftPos = binary.left.start;
                for (const prop of binary.vars.sort((a, b) => a.start - b.start)) {
                    gen.addText(originalCode.substring(leftPos, prop.start));
                    if (prop.isShortand) {
                        gen.addCode(
                            prop.text,
                            prop,
                            SourceMaps.Mode.Offset,
                            {
                                vueTag: 'scriptSetup',
                                capabilities: {
                                    diagnostic: true,
                                },
                            },
                        );
                        gen.addText(`: `);
                    }
                    gen.addCode(
                        `__VLS_refs_${prop.text}`,
                        prop,
                        SourceMaps.Mode.Totally,
                        {
                            vueTag: 'scriptSetup',
                            capabilities: {
                                diagnostic: true,
                            },
                        },
                    );
                    leftPos = prop.end;
                }
                gen.addText(originalCode.substring(leftPos, binary.left.end));

                if (binary.right) {
                    gen.addText(` = `);
                    mapSubText(binary.right.start, binary.right.end);
                }
            }
            gen.addText(`;\n`);

            for (const binary of label.binarys) {
                for (const prop of binary.vars) {
                    gen.addText(`let `);
                    const refVarRange = gen.addCode(
                        prop.text,
                        {
                            start: prop.start,
                            end: prop.end,
                        },
                        SourceMaps.Mode.Offset,
                        {
                            vueTag: 'scriptSetup',
                            capabilities: {
                                basic: true, // hover
                                references: true,
                                diagnostic: true,
                            },
                        },
                    );
                    gen.addText(` = (await import('__VLS_vue')).__VLS_unref(`);
                    if (binary.right) {
                        gen.addCode(
                            `__VLS_refs_${prop.text}`,
                            binary.right,
                            SourceMaps.Mode.Offset, // TODO
                            {
                                vueTag: 'scriptSetup',
                                capabilities: {},
                            },
                        );
                    }
                    else {
                        gen.addText(`__VLS_refs_${prop.text}`);
                    }
                    gen.addText(`); ${prop.text};\n`);

                    gen.addText(`const `);
                    const dollarRefVarRange = gen.addCode(
                        '$' + prop.text,
                        {
                            start: prop.start,
                            end: prop.end,
                        },
                        SourceMaps.Mode.Offset, // TODO
                        {
                            vueTag: 'scriptSetup',
                            capabilities: {
                                diagnostic: true,
                            },
                        },
                    );
                    gen.addText(` = (await import('__VLS_vue')).__VLS_ref(`);
                    if (binary.right) {
                        gen.addCode(
                            `__VLS_refs_${prop.text}`,
                            binary.right,
                            SourceMaps.Mode.Offset, // TODO
                            {
                                vueTag: 'scriptSetup',
                                capabilities: {},
                            },
                        );
                    }
                    else {
                        gen.addText(`__VLS_refs_${prop.text}`);
                    }
                    gen.addText(`); $${prop.text};\n`);

                    teleports.push({
                        mode: SourceMaps.Mode.Offset,
                        sourceRange: (prop as any)['teleportRange'],
                        mappedRange: refVarRange,
                        data: {
                            toSource: {
                                capabilities: {
                                    rename: true,
                                },
                            },
                            toTarget: {
                                capabilities: {
                                    rename: true,
                                    references: true,
                                },
                            },
                        },
                    });
                    teleports.push({
                        mode: SourceMaps.Mode.Totally,
                        sourceRange: refVarRange,
                        mappedRange: dollarRefVarRange,
                        additional: [
                            {
                                mode: SourceMaps.Mode.Offset,
                                sourceRange: refVarRange,
                                mappedRange: {
                                    start: dollarRefVarRange.start + 1, // remove $
                                    end: dollarRefVarRange.end,
                                },
                            },
                        ],
                        data: {
                            toTarget: {
                                editRenameText: newName => '$' + newName,
                                capabilities: {
                                    references: true,
                                    rename: true,
                                },
                            },
                            toSource: {
                                editRenameText: newName => newName.startsWith('$') ? newName.substr(1) : newName,
                                capabilities: {
                                    references: true,
                                    rename: true,
                                },
                            },
                        },
                    });
                }
            }

            tsOffset = label.end;
        }
        mapSubText(tsOffset, sourceCode.length);

        gen.addText(`return {\n`);
        for (const expose of data.exposeVarNames) {
            const varName = originalCode.substring(expose.start, expose.end);
            const templateSideRange = gen.addText(varName);
            gen.addText(': ');
            const scriptSideRange = gen.addText(varName);
            gen.addText(',\n');

            teleports.push({
                sourceRange: scriptSideRange,
                mappedRange: templateSideRange,
                mode: SourceMaps.Mode.Offset,
                data: {
                    toSource: {
                        capabilities: {
                            definitions: true,
                            references: true,
                            rename: true,
                        },
                    },
                    toTarget: {
                        capabilities: {
                            definitions: true,
                            references: true,
                            rename: true,
                        },
                    },
                },
            });
        }
        for (const label of data.labels) {
            for (const binary of label.binarys) {
                for (const refVar of binary.vars) {
                    if (refVar.inRoot) {
                        const templateSideRange = gen.addText(refVar.text);
                        gen.addText(': ');
                        const scriptSideRange = gen.addText(refVar.text);
                        gen.addText(', \n');

                        teleports.push({
                            sourceRange: scriptSideRange,
                            mappedRange: templateSideRange,
                            mode: SourceMaps.Mode.Offset,
                            data: {
                                toSource: {
                                    capabilities: {
                                        definitions: true,
                                        references: true,
                                        rename: true,
                                    },
                                },
                                toTarget: {
                                    capabilities: {
                                        definitions: true,
                                        references: true,
                                        rename: true,
                                    },
                                },
                            },
                        });
                    }
                }
            }
        }
        gen.addText(`};\n`);
        gen.addText(`}});\n`);

        gen.addText(`\n// @ts-ignore\n`);
        gen.addText(`ref${SearchTexts.Ref}\n`); // for execute auto import

        function mapSubText(start: number, end: number) {
            gen.addCode(
                sourceCode.substring(start, end),
                {
                    start,
                    end,
                },
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {
                        basic: true,
                        references: true,
                        definitions: true,
                        diagnostic: true,
                        rename: true,
                        completion: true,
                        semanticTokens: true,
                    },
                },
            );
        }
    }
    function writeExportOptions() {
        gen.addText(`\n`);
        gen.addText(`export const __VLS_options = {\n`);
        gen.addText(`...(`);
        const defaultExport = scriptAst?.exportDefault?.args;
        if (defaultExport) {
            gen.addCode(
                defaultExport.text,
                defaultExport,
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'script',
                    capabilities: {
                        references: true,
                        rename: true,
                    },
                },
            );
        }
        else {
            gen.addText(`{}`);
        }
        gen.addText(`),\n`);
        if (scriptSetupAst?.defineProps?.args && scriptSetup) {
            gen.addText(`props: (`);
            gen.addCode(
                scriptSetup.content.substring(scriptSetupAst.defineProps.args.start, scriptSetupAst.defineProps.args.end),
                scriptSetupAst.defineProps.args,
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {
                        references: true,
                        definitions: true,
                        rename: true,
                    },
                },
            );
            gen.addText(`),\n`);
        }
        if (scriptSetupAst?.defineProps?.typeArgs && scriptSetup) {
            gen.addText(`props: ({} as `);
            gen.addCode(
                scriptSetup.content.substring(scriptSetupAst.defineProps.typeArgs.start, scriptSetupAst.defineProps.typeArgs.end),
                scriptSetupAst.defineProps.typeArgs,
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {
                        references: true,
                        definitions: true,
                        rename: true,
                    },
                },
            );
            gen.addText(`),\n`);
        }
        if (scriptSetupAst?.defineEmit?.args && scriptSetup) {
            gen.addText(`emits: (`);
            gen.addCode(
                scriptSetup.content.substring(scriptSetupAst.defineEmit.args.start, scriptSetupAst.defineEmit.args.end),
                scriptSetupAst.defineEmit.args,
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {
                        references: true,
                        definitions: true,
                        rename: true,
                    },
                },
            );
            gen.addText(`),\n`);
        }
        gen.addText(`};\n`);
    }
}
