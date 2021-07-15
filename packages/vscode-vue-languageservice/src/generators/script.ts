import { createCodeGen } from '@volar/code-gen';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import * as SourceMaps from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';
import * as path from 'upath';

export function generate(
    lsType: 'template' | 'script',
    uri: string,
    script: null | {
        src?: string,
        content: string,
    },
    scriptSetup: null | {
        content: string,
    },
    scriptRanges: ScriptRanges | undefined,
    scriptSetupRanges: ScriptSetupRanges | undefined,
) {

    const codeGen = createCodeGen<SourceMaps.TsMappingData>();
    const teleports: SourceMaps.Mapping<SourceMaps.TeleportMappingData>[] = [];
    const shouldPatchExportDefault = lsType === 'script' && !!scriptSetup;

    writeScriptSrc();
    writeScript();
    writeScriptSetup();

    if (lsType === 'template') {
        codeGen.addText(`\n// @ts-ignore\n`);
        codeGen.addText(`ref${SearchTexts.Ref};\n`); // for execute auto import
    }
    if (lsType === 'template' || shouldPatchExportDefault)
        writeExportComponent();

    if (lsType === 'template') {
        writeExportOptions();
        writeConstNameOption();
    }

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
                    basic: lsType === 'script',
                    references: true,
                    definitions: lsType === 'script',
                    rename: true,
                    diagnostic: lsType === 'script',
                    formatting: lsType === 'script',
                    completion: lsType === 'script',
                    semanticTokens: lsType === 'script',
                    foldingRanges: lsType === 'script',
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
        if (shouldPatchExportDefault && scriptRanges?.exportDefault) {
            const insteadOfExport = 'await ';
            const newStart = scriptRanges.exportDefault.start + insteadOfExport.length;
            addText = addText.substr(0, scriptRanges.exportDefault.start)
                + insteadOfExport
                + ' '.repeat(scriptRanges.exportDefault.expression.start - newStart)
                + addText.substr(scriptRanges.exportDefault.expression.start);
        }
        codeGen.addCode(
            addText,
            { start: 0, end: script.content.length },
            SourceMaps.Mode.Offset,
            {
                vueTag: 'script',
                capabilities: {
                    basic: lsType === 'script',
                    references: true,
                    definitions: lsType === 'script',
                    rename: true,
                    diagnostic: lsType === 'script',
                    formatting: lsType === 'script',
                    completion: lsType === 'script',
                    semanticTokens: lsType === 'script',
                    foldingRanges: lsType === 'script',
                },
            }
        );
    }
    function writeScriptSetup() {
        if (!scriptSetup)
            return;
        if (!scriptSetupRanges)
            return;

        const data = scriptSetupRanges;
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
                            completion: lsType === 'script',
                            definitions: lsType === 'script',
                            references: true,
                            semanticTokens: lsType === 'script',
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
                                    diagnostic: lsType === 'script',
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
                                diagnostic: lsType === 'script',
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
                                basic: lsType === 'script', // hover
                                references: true,
                                diagnostic: lsType === 'script',
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
                                diagnostic: lsType === 'script',
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
                        basic: lsType === 'script',
                        references: true,
                        definitions: lsType === 'script',
                        diagnostic: lsType === 'script',
                        rename: true,
                        completion: lsType === 'script',
                        semanticTokens: lsType === 'script',
                    },
                },
            );
        }
    }
    function writeExportComponent() {
        codeGen.addText(`\n`);
        const start = codeGen.getText().length;
        if (shouldPatchExportDefault) {
            codeGen.addText(`export default __VLS_defineComponent({\n`);
        }
        else {
            codeGen.addText(`export const __VLS_component = __VLS_defineComponent({\n`);
        }
        if (script && scriptRanges?.exportDefault?.args) {
            const args = scriptRanges.exportDefault.args;
            codeGen.addText(`...(${script.content.substring(args.start, args.end)}),\n`);
        }
        if (scriptSetup && scriptSetupRanges) {
            if (scriptSetupRanges.propsRuntimeArg || scriptSetupRanges.propsTypeArg) {
                codeGen.addText(`props: (`);
                if (scriptSetupRanges.withDefaultsArg) codeGen.addText(`__VLS_mergePropDefaults(`);
                if (scriptSetupRanges.propsRuntimeArg) codeGen.addText(scriptSetup.content.substring(scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end));
                else if (scriptSetupRanges.propsTypeArg) codeGen.addText(`{} as __VLS_DefinePropsToOptions<${scriptSetup.content.substring(scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end)}>`);
                if (scriptSetupRanges.withDefaultsArg) codeGen.addText(`, ${scriptSetup.content.substring(scriptSetupRanges.withDefaultsArg.start, scriptSetupRanges.withDefaultsArg.end)})`);
                codeGen.addText(`),\n`);
            }
            if (scriptSetupRanges.emitsRuntimeArg) {
                codeGen.addText(`emits: (${scriptSetup.content.substring(scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end)}),\n`);
            }
            else if (scriptSetupRanges.emitsTypeArg) {
                codeGen.addText(`emits: ({} as __VLS_ConstructorOverloads<${scriptSetup.content.substring(scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end)}>),\n`);
            }
            const bindingsArr: {
                bindings: { start: number, end: number }[],
                content: string,
                vueTag: 'script' | 'scriptSetup',
            }[] = [];
            if (scriptSetupRanges) {
                bindingsArr.push({
                    bindings: scriptSetupRanges.bindings,
                    content: scriptSetup.content,
                    vueTag: 'scriptSetup',
                });
            }
            if (scriptRanges && script) {
                bindingsArr.push({
                    bindings: scriptRanges.bindings,
                    content: script.content,
                    vueTag: 'script',
                });
            }
            codeGen.addText(`setup() {\n`);
            codeGen.addText(`return {\n`);
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
            if (scriptSetupRanges && scriptSetup) {
                for (const label of scriptSetupRanges.labels) {
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
        }

        codeGen.addText(`});`);
        const end = codeGen.getText().length;
        codeGen.addText(`\n`);

        if (scriptSetup) {
            codeGen.addMapping2({
                data: {
                    vueTag: 'scriptSetup',
                    capabilities: {},
                },
                mode: SourceMaps.Mode.Totally,
                sourceRange: {
                    start: 0,
                    end: scriptSetup.content.length,
                },
                mappedRange: {
                    start,
                    end,
                },
            });
        }
    }
    function writeExportOptions() {
        codeGen.addText(`\n`);
        codeGen.addText(`export const __VLS_options = {\n`);
        if (script && scriptRanges?.exportDefault?.args) {
            const args = scriptRanges.exportDefault.args;
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
        if (scriptSetupRanges?.propsRuntimeArg && scriptSetup) {
            codeGen.addText(`props: (`);
            codeGen.addCode(
                scriptSetup.content.substring(scriptSetupRanges.propsRuntimeArg.start, scriptSetupRanges.propsRuntimeArg.end),
                scriptSetupRanges.propsRuntimeArg,
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
        if (scriptSetupRanges?.propsTypeArg && scriptSetup) {
            codeGen.addText(`props: ({} as `);
            codeGen.addCode(
                scriptSetup.content.substring(scriptSetupRanges.propsTypeArg.start, scriptSetupRanges.propsTypeArg.end),
                scriptSetupRanges.propsTypeArg,
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
        if (scriptSetupRanges?.emitsRuntimeArg && scriptSetup) {
            codeGen.addText(`emits: (`);
            codeGen.addCode(
                scriptSetup.content.substring(scriptSetupRanges.emitsRuntimeArg.start, scriptSetupRanges.emitsRuntimeArg.end),
                scriptSetupRanges.emitsRuntimeArg,
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
        if (scriptSetupRanges?.emitsTypeArg && scriptSetup) {
            codeGen.addText(`emits: ({} as `);
            codeGen.addCode(
                scriptSetup.content.substring(scriptSetupRanges.emitsTypeArg.start, scriptSetupRanges.emitsTypeArg.end),
                scriptSetupRanges.emitsTypeArg,
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
        if (script && scriptRanges?.exportDefault?.args) {
            const args = scriptRanges.exportDefault.args;
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
