import { fsPathToUri } from '@volar/shared';
import * as path from 'upath';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextEdit } from 'vscode-languageserver-types';
import { Position } from 'vscode-languageserver/node';
import { createTester } from './common';

const volarRoot = path.resolve(__dirname, '../../..');
const testRoot = path.resolve(__dirname, '../testCases');
const tester = createTester(testRoot);
const tests: {
    fileName: string,
    actions: {
        position: Position,
        newName: string,
        length: number,
    }[],
    result: string,
}[] = [
        {
            fileName: path.resolve(__dirname, '../testCases/scriptSetup.vue'),
            actions: [
                {
                    position: Position.create(0, 13),
                    newName: 'bar',
                    length: 4,
                },
                {
                    position: Position.create(3, 5),
                    newName: 'bar',
                    length: 4,
                },
            ],
            result: `
<template>{{ bar }}</template>

<script lang="ts" setup>
ref: bar = 1;
</script>
        `.trim(),
        },
        {
            fileName: path.resolve(__dirname, '../testCases/cssScoped.vue'),
            actions: [
                {
                    position: Position.create(5, 0),
                    newName: '.bar',
                    length: 5,
                },
                {
                    position: Position.create(1, 16),
                    newName: 'bar',
                    length: 4,
                },
            ],
            result: `
<template>
    <div class="bar"></div>
</template>

<style scoped>
.bar { }
</style>
        `.trim(),
        },
        {
            fileName: path.resolve(__dirname, '../testCases/cssModule.vue'),
            actions: [
                {
                    position: Position.create(5, 0),
                    newName: '.bar',
                    length: 5,
                },
                {
                    position: Position.create(1, 24),
                    newName: 'bar',
                    length: 4,
                },
            ],
            result: `
<template>
    <div :class="$style.bar"></div>
</template>

<style module>
.bar { }
</style>
        `.trim(),
        },
    ];

for (const test of tests) {

    const fileName = test.fileName;
    const uri = fsPathToUri(fileName);
    const script = tester.host.getScriptSnapshot(fileName);

    describe(`renaming ${path.basename(fileName)}`, () => {

        it(`should ${path.basename(fileName)} exist`, () => {
            expect(!!script).toBe(true);
        });
        if (!script) return;

        const scriptText = script.getText(0, script.getLength());

        for (const action of test.actions) {
            for (let i = 0; i < action.length; i++) {
                const location = `${path.relative(volarRoot, fileName)}:${action.position.line + 1}:${action.position.character + i + 1}`;
                it(`rename ${location} => ${action.newName}`, () => {
                    const result = tester.languageService.rename.doRename(
                        uri,
                        { line: action.position.line, character: action.position.character + i },
                        action.newName,
                    );

                    const textEdits = result?.changes?.[uri];
                    expect(!!textEdits).toEqual(true);
                    if (!textEdits) return;

                    const textResult = applyTextEdits(scriptText, textEdits);
                    expect(textResult).toEqual(test.result);
                });
            }
        }
    });
}

function applyTextEdits(originalText: string, textEdits: TextEdit[]) {

    const document = TextDocument.create('', '', 0, originalText);
    textEdits = textEdits.sort((a, b) => document.offsetAt(b.range.start) - document.offsetAt(a.range.start));

    let newText = document.getText();
    for (const textEdit of textEdits) {
        newText = editText(
            newText,
            document.offsetAt(textEdit.range.start),
            document.offsetAt(textEdit.range.end),
            textEdit.newText
        )
    }

    return newText;

    function editText(sourceText: string, startOffset: number, endOffset: number, newText: string) {
        return sourceText.substring(0, startOffset)
            + newText
            + sourceText.substring(endOffset, sourceText.length)
    }
}
