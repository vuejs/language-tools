import { createCodeGen } from '@volar/code-gen';
import { hyphenate } from '@vue/shared';
import type * as templateGen from '../generators/template_scriptSetup';
import type { ScriptRanges } from '../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../parsers/scriptSetupRanges';
import * as SourceMaps from '../utils/sourceMaps';

export function generate(
    script: null | {
        src?: string,
        content: string,
    },
    scriptSetup: null | {
        content: string,
    },
    scriptRanges: ScriptRanges | undefined,
    scriptSetupRanges: ScriptSetupRanges | undefined,
    htmlGen: ReturnType<typeof templateGen['generate']> | undefined,
) {

    if (!scriptSetup) return;

    const codeGen = createCodeGen<SourceMaps.TsMappingData>();

    writeScript();
    writeScriptSetup();
    writeTemplate();
    codeGen.addText('\n;export { };\n');

    return codeGen;

    function writeScript() {
        if (!script)
            return;

        codeGen.addCode(
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
        codeGen.addText('\n');
    }
    function writeScriptSetup() {
        if (!scriptSetup)
            return;
        if (!scriptSetupRanges)
            return;

        let noDollarCode = scriptSetup.content;
        for (const dollar of scriptSetupRanges.dollars) {
            noDollarCode = noDollarCode.substring(0, dollar) + ' ' + noDollarCode.substring(dollar + 1); // replace '$'
        }
        for (const label of scriptSetupRanges.labels) {
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
        codeGen.addCode(
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
        if (!scriptSetup)
            return;
        if (!htmlGen)
            return;

        let bindingNames: string[] = [];

        if (scriptSetupRanges) {
            bindingNames = bindingNames.concat(scriptSetupRanges.bindings.map(range => scriptSetup?.content.substring(range.start, range.end) ?? ''));
        }
        if (scriptRanges) {
            bindingNames = bindingNames.concat(scriptRanges.bindings.map(range => script?.content.substring(range.start, range.end) ?? ''));
        }

        codeGen.addText('{\n');
        for (const varName of bindingNames) {
            if (htmlGen.tags.has(varName) || htmlGen.tags.has(hyphenate(varName))) {
                // fix import components unused report
                codeGen.addText(varName + ';\n');
            }
        }
        codeGen.addText(htmlGen.text);
        codeGen.addText('}\n');
    }
}
