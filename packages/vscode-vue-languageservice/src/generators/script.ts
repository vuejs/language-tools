import type { Ast as ScriptAst } from '../parsers/scriptAst';
import type { Ast as ScriptSetupAst } from '../parsers/scriptSetupAst';
import * as SourceMaps from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';

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

    writeScriptSrc();
    writeScript();
    writeScriptSetup();
    if (scriptSetup) {
        writeExportComponent();
    }
    writeExportOptions();

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
                    gen.addText(` = (await import('vue')).unref(`);
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
                    gen.addText(` = (await import('vue')).ref(`);
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
    function writeExportComponent() {
        gen.addText(`\n`);
        gen.addText(`export const __VLS_component = __VLS_defineComponent({\n`);
        if (script && scriptAst?.exportDefault?.args) {
            const args = scriptAst.exportDefault.args;
            gen.addText(`...(${script.content.substring(args.start, args.end)}),\n`);
        }
        if (scriptSetupAst?.defineProps?.args && scriptSetup) {
            gen.addText(`props: (${scriptSetup.content.substring(scriptSetupAst.defineProps.args.start, scriptSetupAst.defineProps.args.end)}),\n`);
        }
        if (scriptSetupAst?.defineProps?.typeArgs && scriptSetup) {
            gen.addText(`props: ({} as __VLS_DefinePropsToOptions<${scriptSetup.content.substring(scriptSetupAst.defineProps.typeArgs.start, scriptSetupAst.defineProps.typeArgs.end)}>),\n`);
        }
        if (scriptSetupAst?.defineEmit?.args && scriptSetup) {
            gen.addText(`emits: (${scriptSetup.content.substring(scriptSetupAst.defineEmit.args.start, scriptSetupAst.defineEmit.args.end)}),\n`);
        }
        if (scriptSetupAst?.defineEmit?.typeArgs && scriptSetup) {
            gen.addText(`emits: ({} as __VLS_ConstructorOverloads<${scriptSetup.content.substring(scriptSetupAst.defineEmit.typeArgs.start, scriptSetupAst.defineEmit.typeArgs.end)}>),\n`);
        }
        if (scriptSetupAst && scriptSetup) {
            gen.addText(`setup() {\n`);
            gen.addText(`return {\n`);
            for (const expose of scriptSetupAst.returnVarNames) {
                const varName = scriptSetup.content.substring(expose.start, expose.end);
                const templateSideRange = gen.addText(varName);
                gen.addText(': ');
                const scriptSideRange = expose.isImport
                    ? gen.addCode(
                        varName,
                        expose,
                        SourceMaps.Mode.Offset,
                        {
                            vueTag: 'scriptSetup',
                            capabilities: { diagnostic: true },
                        },
                    )
                    : gen.addText(varName);
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
            for (const label of scriptSetupAst.labels) {
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
            gen.addText(`},\n`);
        }
        gen.addText(`});\n`);
    }
    function writeExportOptions() {
        gen.addText(`\n`);
        gen.addText(`export const __VLS_options = {\n`);
        if (script && scriptAst?.exportDefault?.args) {
            const args = scriptAst.exportDefault.args;
            gen.addText(`...(`);
            gen.addCode(
                script.content.substring(args.start, args.end),
                args,
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'script',
                    capabilities: {
                        references: true,
                        rename: true,
                    },
                },
            );
            gen.addText(`),\n`);
        }
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
            gen.addText(`) as const,\n`);
        }
        if (scriptSetupAst?.defineEmit?.typeArgs && scriptSetup) {
            gen.addText(`emits: ({} as `);
            gen.addCode(
                scriptSetup.content.substring(scriptSetupAst.defineEmit.typeArgs.start, scriptSetupAst.defineEmit.typeArgs.end),
                scriptSetupAst.defineEmit.typeArgs,
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {},
                },
            );
            gen.addText(`),\n`);
        }
        gen.addText(`};\n`);
    }
}
