import { createScriptGenerator } from '@volar/source-map';
import type * as templateGen from '../generators/template_scriptSetup';
import type { Ast as ScriptSetupAst } from '../parsers/scriptSetupAst';
import * as SourceMaps from '../utils/sourceMaps';

export function generate(
    script: null | {
        src?: string,
        content: string,
    },
    scriptSetup: null | {
        content: string,
    },
    scriptSetupAst: ScriptSetupAst | undefined,
    htmlGen: ReturnType<typeof templateGen['generate']> | undefined,
) {

    if (!scriptSetup) return;

    const gen = createScriptGenerator<SourceMaps.TsMappingData>();

    writeScript();
    writeScriptSetup();
    writeTemplate();
    gen.addText('\n;export { };\n');

    function writeScript() {
        if (!script)
            return;

        gen.addCode(
            script.content,
            { start: 0, end: script.content.length },
            SourceMaps.Mode.Offset,
            {
                vueTag: 'script',
                capabilities: {
                    diagnostic: true,
                },
            },
        );
        gen.addText('\n');
    }
    function writeScriptSetup() {
        if (!scriptSetup)
            return;
        if (!scriptSetupAst)
            return;

        let noDollarCode = scriptSetup.content;
        for (const dollar of scriptSetupAst.dollars) {
            noDollarCode = noDollarCode.substring(0, dollar) + ' ' + noDollarCode.substring(dollar + 1); // replace '$'
        }
        for (const label of scriptSetupAst.labels) {
            noDollarCode = noDollarCode.substring(0, label.label.start) + 'let' + noDollarCode.substring(label.label.end).replace(':', ' '); // replace 'ref:'
            if (label.binarys.length) {
                const start = label.binarys[0];
                const end = label.binarys[label.binarys.length - 1];
                if (start.parent.start !== start.left.start) {
                    noDollarCode = noDollarCode.substring(0, start.parent.start) + ' '.repeat(start.left.start - start.parent.start) + noDollarCode.substring(start.left.start); // replace '('
                }
                const endOffset = (end.right ?? end.left).end;
                if (end.parent.end !== endOffset) {
                    noDollarCode = noDollarCode.substring(0, endOffset) + ' '.repeat(end.parent.end - endOffset) + noDollarCode.substring(end.parent.end); // replace ')'
                }
            }
        }
        gen.addCode(
            noDollarCode,
            { start: 0, end: noDollarCode.length },
            SourceMaps.Mode.Offset,
            {
                vueTag: 'scriptSetup',
                capabilities: {
                    diagnostic: true,
                },
            },
        );
    }
    function writeTemplate() {
        if (!scriptSetupAst)
            return;
        if (!htmlGen)
            return;

        const scriptSetupVars = scriptSetupAst.returnVarNames
            .map(range => scriptSetup?.content.substring(range.start, range.end) ?? '');
        gen.addText('{\n');
        for (const scriptSetupVar of scriptSetupVars) {
            if (htmlGen.tags.has(scriptSetupVar) || htmlGen.tags.has(scriptSetupVar)) {
                // fix import components unused report
                gen.addText(scriptSetupVar + ';\n');
            }
        }
        gen.addText(htmlGen.text);
        gen.addText('}\n');
    }

    return {
        code: gen.getText(),
        mappings: gen.getMappings(),
    }
}
