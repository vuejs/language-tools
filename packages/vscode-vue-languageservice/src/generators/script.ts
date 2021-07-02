import { createCodeGen } from '@volar/code-gen';
import type { Ast as ScriptAst } from '../parsers/scriptAst';
import type { Ast as ScriptSetupAst } from '../parsers/scriptSetupAst';
import * as SourceMaps from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';
import * as path from 'upath';

export function generate(
    uri: string,
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

    const codeGen = createCodeGen<SourceMaps.TsMappingData>();
    const teleports: SourceMaps.Mapping<SourceMaps.TeleportMappingData>[] = [];

    writeScriptSrc();
    writeScript();
    writeScriptSetup();
    writeExportComponent();
    writeExportOptions();
    writeConstNameOption();

    return {
        ...codeGen,
        teleports,
    };

    function writeScriptSrc() {
        if (!script?.src)
            return;

        let src = script.src;

        if (src.endsWith('.d.ts')) src = path.removeExt(src, '.d.ts');
        else if (src.endsWith('.ts')) src = path.removeExt(src, '.ts');
        else if (src.endsWith('.tsx')) src = path.removeExt(src, '.tsx');

        codeGen.addText(`export * from `);
        codeGen.addCode(
            `'${src}'`,
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
        codeGen.addText(`;\n`);
        codeGen.addText(`export { default } from '${src}';\n`);
    }
    function writeScript() {
        if (!script)
            return;

        let addText = script.content;
        codeGen.addCode(
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

        const labels = data.labels.sort((a, b) => a.start - b.start);
        let tsOffset = 0;
        for (const label of labels) {
            mapSubText(tsOffset, label.start);
            let first = true;

            codeGen.addText(`{ `);
            for (const binary of label.binarys) {
                if (first) {
                    first = false;
                    codeGen.addText(`let `);
                }
                else {
                    codeGen.addText(`, `);
                }
                for (const v of binary.vars) {
                    (v as any)['teleportRange'] = {
                        start: codeGen.getText().length + v.start - binary.left.start,
                        end: codeGen.getText().length + v.end - binary.left.start,
                    };
                }
                codeGen.addCode(
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
                    codeGen.addText(` = `);
                    mapSubText(binary.right.start, binary.right.end);
                }
            }
            codeGen.addText(`; }\n`);

            first = true;
            for (const binary of label.binarys) {
                if (first) {
                    first = false;
                    codeGen.addText(`const `);
                }
                else {
                    codeGen.addText(`, `);
                }

                let leftPos = binary.left.start;
                for (const prop of binary.vars.sort((a, b) => a.start - b.start)) {
                    const propName = scriptSetup.content.substring(prop.start, prop.end);
                    codeGen.addText(originalCode.substring(leftPos, prop.start));
                    if (prop.isShortand) {
                        codeGen.addCode(
                            propName,
                            prop,
                            SourceMaps.Mode.Offset,
                            {
                                vueTag: 'scriptSetup',
                                capabilities: {
                                    diagnostic: true,
                                },
                            },
                        );
                        codeGen.addText(`: `);
                    }
                    codeGen.addCode(
                        `__VLS_refs_${propName}`,
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
                codeGen.addText(originalCode.substring(leftPos, binary.left.end));

                if (binary.right) {
                    codeGen.addText(` = `);
                    codeGen.addText(originalCode.substring(binary.right.start, binary.right.end));
                }
            }
            codeGen.addText(`;\n`);

            for (const binary of label.binarys) {
                for (const prop of binary.vars) {
                    const propName = scriptSetup.content.substring(prop.start, prop.end);
                    codeGen.addText(`let `);
                    const refVarRange = codeGen.addCode(
                        propName,
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
                    codeGen.addText(` = (await import('vue')).unref(`);
                    if (binary.right) {
                        codeGen.addCode(
                            `__VLS_refs_${propName}`,
                            binary.right,
                            SourceMaps.Mode.Offset, // TODO
                            {
                                vueTag: 'scriptSetup',
                                capabilities: {},
                            },
                        );
                    }
                    else {
                        codeGen.addText(`__VLS_refs_${propName}`);
                    }
                    codeGen.addText(`); ${propName};\n`);

                    codeGen.addText(`const `);
                    const dollarRefVarRange = codeGen.addCode(
                        '$' + propName,
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
                    codeGen.addText(` = (await import('vue')).ref(`);
                    if (binary.right) {
                        codeGen.addCode(
                            `__VLS_refs_${propName}`,
                            binary.right,
                            SourceMaps.Mode.Offset, // TODO
                            {
                                vueTag: 'scriptSetup',
                                capabilities: {},
                            },
                        );
                    }
                    else {
                        codeGen.addText(`__VLS_refs_${propName}`);
                    }
                    codeGen.addText(`); $${propName};\n`);

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

        codeGen.addText(`\n// @ts-ignore\n`);
        codeGen.addText(`ref${SearchTexts.Ref}\n`); // for execute auto import

        function mapSubText(start: number, end: number) {
            codeGen.addCode(
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
        codeGen.addText(`\n`);
        codeGen.addText(`export const __VLS_component = __VLS_defineComponent({\n`);
        if (script && scriptAst?.exportDefault?.args) {
            const args = scriptAst.exportDefault.args;
            codeGen.addText(`...(${script.content.substring(args.start, args.end)}),\n`);
        }
        if (scriptSetupAst?.propsRuntimeArg && scriptSetup) {
            codeGen.addText(`props: (${scriptSetup.content.substring(scriptSetupAst.propsRuntimeArg.start, scriptSetupAst.propsRuntimeArg.end)}),\n`);
        }
        if (scriptSetupAst?.propsTypeArg && scriptSetup) {
            codeGen.addText(`props: ({} as __VLS_DefinePropsToOptions<${scriptSetup.content.substring(scriptSetupAst.propsTypeArg.start, scriptSetupAst.propsTypeArg.end)}>),\n`);
        }
        if (scriptSetupAst?.emitsRuntimeArg && scriptSetup) {
            codeGen.addText(`emits: (${scriptSetup.content.substring(scriptSetupAst.emitsRuntimeArg.start, scriptSetupAst.emitsRuntimeArg.end)}),\n`);
        }
        if (scriptSetupAst?.emitsTypeArg && scriptSetup) {
            codeGen.addText(`emits: ({} as __VLS_ConstructorOverloads<${scriptSetup.content.substring(scriptSetupAst.emitsTypeArg.start, scriptSetupAst.emitsTypeArg.end)}>),\n`);
        }
        codeGen.addText(`setup() {\n`);
        codeGen.addText(`return {\n`);
        const bindingsArr: {
            bindings: { start: number, end: number }[],
            content: string,
            vueTag: 'script' | 'scriptSetup',
        }[] = [];
        if (scriptSetupAst && scriptSetup) {
            bindingsArr.push({
                bindings: scriptSetupAst.bindings,
                content: scriptSetup.content,
                vueTag: 'scriptSetup',
            });
        }
        if (scriptAst && script) {
            bindingsArr.push({
                bindings: scriptAst.bindings,
                content: script.content,
                vueTag: 'script',
            });
        }
        for (const { bindings, content, vueTag } of bindingsArr) {
            for (const expose of bindings) {
                const varName = content.substring(expose.start, expose.end);
                const templateSideRange = codeGen.addText(varName);
                codeGen.addText(': ');
                const scriptSideRange = codeGen.addCode(
                    varName,
                    expose,
                    SourceMaps.Mode.Offset,
                    {
                        vueTag,
                        capabilities: { diagnostic: true },
                    },
                );
                codeGen.addText(',\n');

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
        if (scriptSetupAst && scriptSetup) {
            for (const label of scriptSetupAst.labels) {
                for (const binary of label.binarys) {
                    for (const refVar of binary.vars) {
                        if (refVar.inRoot) {
                            const varName = scriptSetup.content.substring(refVar.start, refVar.end);
                            const templateSideRange = codeGen.addText(varName);
                            codeGen.addText(': ');
                            const scriptSideRange = codeGen.addText(varName);
                            codeGen.addText(', \n');

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
        }
        codeGen.addText(`};\n`);
        codeGen.addText(`},\n`);

        codeGen.addText(`});\n`);
    }
    function writeExportOptions() {
        codeGen.addText(`\n`);
        codeGen.addText(`export const __VLS_options = {\n`);
        if (script && scriptAst?.exportDefault?.args) {
            const args = scriptAst.exportDefault.args;
            codeGen.addText(`...(`);
            codeGen.addCode(
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
            codeGen.addText(`),\n`);
        }
        if (scriptSetupAst?.propsRuntimeArg && scriptSetup) {
            codeGen.addText(`props: (`);
            codeGen.addCode(
                scriptSetup.content.substring(scriptSetupAst.propsRuntimeArg.start, scriptSetupAst.propsRuntimeArg.end),
                scriptSetupAst.propsRuntimeArg,
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
            codeGen.addText(`),\n`);
        }
        if (scriptSetupAst?.propsTypeArg && scriptSetup) {
            codeGen.addText(`props: ({} as `);
            codeGen.addCode(
                scriptSetup.content.substring(scriptSetupAst.propsTypeArg.start, scriptSetupAst.propsTypeArg.end),
                scriptSetupAst.propsTypeArg,
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
            codeGen.addText(`),\n`);
        }
        if (scriptSetupAst?.emitsRuntimeArg && scriptSetup) {
            codeGen.addText(`emits: (`);
            codeGen.addCode(
                scriptSetup.content.substring(scriptSetupAst.emitsRuntimeArg.start, scriptSetupAst.emitsRuntimeArg.end),
                scriptSetupAst.emitsRuntimeArg,
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
            codeGen.addText(`),\n`);
        }
        if (scriptSetupAst?.emitsTypeArg && scriptSetup) {
            codeGen.addText(`emits: ({} as `);
            codeGen.addCode(
                scriptSetup.content.substring(scriptSetupAst.emitsTypeArg.start, scriptSetupAst.emitsTypeArg.end),
                scriptSetupAst.emitsTypeArg,
                SourceMaps.Mode.Offset,
                {
                    vueTag: 'scriptSetup',
                    capabilities: {},
                },
            );
            codeGen.addText(`),\n`);
        }
        codeGen.addText(`};\n`);
    }
    function writeConstNameOption() {
        codeGen.addText(`\n`);
        if (script && scriptAst?.exportDefault?.args) {
            const args = scriptAst.exportDefault.args;
            codeGen.addText(`export const __VLS_name = __VLS_getNameOption(`);
            codeGen.addText(`${script.content.substring(args.start, args.end)} as const`);
            codeGen.addText(`);\n`);
        }
        else if (scriptSetup && path.extname(uri) === '.vue') {
            codeGen.addText(`export declare const __VLS_name: '${path.basename(path.trimExt(uri))}';\n`);
        }
        else {
            codeGen.addText(`export const __VLS_name = undefined;\n`);
        }
    }
}
