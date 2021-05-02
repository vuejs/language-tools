import { createTester } from './common';
import { fsPathToUri } from '@volar/shared';
import { Position } from 'vscode-languageserver/node';
import * as path from 'upath';

const scriptSetupLocs = {
    template_foo: Position.create(0, 13),
    script_foo: Position.create(3, 5),
};

describe('renaming', () => {

    const root = path.resolve(__dirname, '../testCases');
    const tester = createTester(root);
    const fileName = path.resolve(__dirname, '../testCases/scriptSetup.vue');
    const uri = fsPathToUri(fileName);
    const script = tester.host.getScriptSnapshot(fileName);

    it('should scriptSetup.vue exist', () => {
        expect(!!script).toBe(true);
    });
    if (!script) return;

    it('rename in <script>', () => {
        const result = tester.languageService.rename.doRename(
            uri,
            scriptSetupLocs.script_foo,
            'bar',
        );
        const changes = result?.changes?.[uri];

        expect(!!changes).toEqual(true);
        if (!changes) return;

        expect(changes.length).toEqual(2);
        expect(changes.some(change =>
            change.range.start.line === scriptSetupLocs.script_foo.line
            && change.range.start.character === scriptSetupLocs.script_foo.character
            && change.range.end.line === scriptSetupLocs.script_foo.line
            && change.range.end.character === scriptSetupLocs.script_foo.character + 'foo'.length
            && change.newText === 'bar'
        )).toBe(true);
        expect(changes.some(change =>
            change.range.start.line === scriptSetupLocs.template_foo.line
            && change.range.start.character === scriptSetupLocs.template_foo.character
            && change.range.end.line === scriptSetupLocs.template_foo.line
            && change.range.end.character === scriptSetupLocs.template_foo.character + 'foo'.length
            && change.newText === 'bar'
        )).toBe(true);
    });
    it('rename in <template>', () => {
        const result = tester.languageService.rename.doRename(
            uri,
            scriptSetupLocs.template_foo,
            'bar',
        );
        const changes = result?.changes?.[uri];

        expect(!!changes).toEqual(true);
        if (!changes) return;

        expect(changes.length).toEqual(2);
        expect(changes.some(change =>
            change.range.start.line === scriptSetupLocs.script_foo.line
            && change.range.start.character === scriptSetupLocs.script_foo.character
            && change.range.end.line === scriptSetupLocs.script_foo.line
            && change.range.end.character === scriptSetupLocs.script_foo.character + 'foo'.length
            && change.newText === 'bar'
        )).toBe(true);
        expect(changes.some(change =>
            change.range.start.line === scriptSetupLocs.template_foo.line
            && change.range.start.character === scriptSetupLocs.template_foo.character
            && change.range.end.line === scriptSetupLocs.template_foo.line
            && change.range.end.character === scriptSetupLocs.template_foo.character + 'foo'.length
            && change.newText === 'bar'
        )).toBe(true);
    });
});
