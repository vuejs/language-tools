import { createTester } from './common';
import { fsPathToUri } from '@volar/shared';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'upath';

describe('renaming', () => {

    const root = path.resolve(__dirname, '../testCases');
    const tester = createTester(root);
    const fileName = path.resolve(__dirname, '../testCases/rename.vue');
    const script = tester.host.getScriptSnapshot(fileName);

    it('shouse vue script exist', () => {
        expect(!!script).toBe(true);
    });
    if (!script) return;

    const text = script.getText(0, script.getLength());
    const doc = TextDocument.create(fsPathToUri(fileName), 'vue', 0, text);
    const locs = {
        a1: getLocation(text, 'a1'),
        a2: getLocation(text, 'a2'),
        b1: getLocation(text, 'b1'),
        b2: getLocation(text, 'b2'),
    };

    it('rename in <script>', () => {
        const result = tester.languageService.rename.doRename(
            doc.uri,
            doc.positionAt(locs.b2.start),
            'bar',
        );
        const changes = result?.changes?.[doc.uri];

        expect(!!changes).toEqual(true);
        if (!changes) return;

        expect(changes.length).toEqual(2);
        expect(!!changes.find(change =>
            doc.offsetAt(change.range.start) === locs.a1.end
            && doc.offsetAt(change.range.end) === locs.a2.start
            && change.newText === 'bar'
        )).toBe(true);
        expect(!!changes.find(change =>
            doc.offsetAt(change.range.start) === locs.b1.end
            && doc.offsetAt(change.range.end) === locs.b2.start
            && change.newText === 'bar'
        )).toBe(true);
    });
    it('rename in <template>', () => {
        const result = tester.languageService.rename.doRename(
            doc.uri,
            doc.positionAt(locs.a2.start),
            'bar',
        );
        const changes = result?.changes?.[doc.uri];

        expect(!!changes).toEqual(true);
        if (!changes) return;

        expect(changes.length).toEqual(2);
        expect(!!changes.find(change =>
            doc.offsetAt(change.range.start) === locs.a1.end
            && doc.offsetAt(change.range.end) === locs.a2.start
            && change.newText === 'bar'
        )).toBe(true);
        expect(!!changes.find(change =>
            doc.offsetAt(change.range.start) === locs.b1.end
            && doc.offsetAt(change.range.end) === locs.b2.start
            && change.newText === 'bar'
        )).toBe(true);
    });
});

function getLocation(text: string, name: string) {
    const searchText = `/*${name}*/`;
    const start = text.indexOf(searchText);
    const end = start + searchText.length;
    return {
        start,
        end,
    };
}
