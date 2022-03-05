import { definePlugin } from './definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFile } from '@volar/vue-typescript';
import * as shared from '@volar/shared';
import { htmlPluginBase } from './htmlPlugin';
import * as vscode from 'vscode-languageserver-protocol';

export { triggerCharacters } from './htmlPlugin';

const vueTags: html.ITagData[] = [
    {
        name: 'template',
        attributes: [
            {
                name: 'lang',
                values: [
                    { name: 'html' },
                    { name: 'pug' },
                ],
            },
        ],
    },
    {
        name: 'script',
        attributes: [
            {
                name: 'lang',
                values: [
                    { name: 'js' },
                    { name: 'ts' },
                    { name: 'jsx' },
                    { name: 'tsx' },
                ],
            },
            { name: 'setup', valueSet: 'v' },
        ],
    },
    {
        name: 'style',
        attributes: [
            {
                name: 'lang',
                values: [
                    { name: 'css' },
                    { name: 'scss' },
                    { name: 'less' },
                ],
            },
            { name: 'scoped', valueSet: 'v' },
            { name: 'module', valueSet: 'v' },
        ],
    },
];

export default definePlugin((host: {
    documentContext?: html.DocumentContext,
    getVueDocument(document: TextDocument): SourceFile | undefined,
}) => {

    const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();
    const htmlLs = html.getLanguageService();
    const dataProvider = html.newHTMLDataProvider('vue', {
        version: 1.1,
        tags: vueTags,
    });
    htmlLs.setDataProviders(false, [dataProvider]);

    return {

        ...htmlPluginBase({
            getHtmlLs: () => htmlLs,
            documentContext: host.documentContext,
        }, getHtmlDocument),

        findDocumentSymbols(document) {
            return worker(document, (vueDocument) => {

                const result: vscode.SymbolInformation[] = [];
                const descriptor = vueDocument.getDescriptor();
    
                if (descriptor.template) {
                    result.push({
                        name: '<template>',
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(descriptor.template.startTagEnd),
                            document.positionAt(descriptor.template.startTagEnd + descriptor.template.content.length),
                        )),
                    });
                }
                if (descriptor.script) {
                    result.push({
                        name: '<script>',
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(descriptor.script.startTagEnd),
                            document.positionAt(descriptor.script.startTagEnd + descriptor.script.content.length),
                        )),
                    });
                }
                if (descriptor.scriptSetup) {
                    result.push({
                        name: '<script setup>',
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(descriptor.scriptSetup.startTagEnd),
                            document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
                        )),
                    });
                }
                for (const style of descriptor.styles) {
                    result.push({
                        name: `<${['style', style.scoped ? 'scoped' : undefined, style.module ? 'module' : undefined].filter(shared.notEmpty).join(' ')}>`,
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(style.startTagEnd),
                            document.positionAt(style.startTagEnd + style.content.length),
                        )),
                    });
                }
                for (const customBlock of descriptor.customBlocks) {
                    result.push({
                        name: `<${customBlock.type}>`,
                        kind: vscode.SymbolKind.Module,
                        location: vscode.Location.create(document.uri, vscode.Range.create(
                            document.positionAt(customBlock.startTagEnd),
                            document.positionAt(customBlock.startTagEnd + customBlock.content.length),
                        )),
                    });
                }
    
                return result;
            });
        },

        getFoldingRanges(document) {
            return worker(document, (vueDocument) => {

                const sfcWithEmptyBlocks = getSfcCodeWithEmptyBlocks(vueDocument, document.getText());
                const sfcWithEmptyBlocksDocument = TextDocument.create(document.uri, document.languageId, document.version, sfcWithEmptyBlocks);

                return htmlLs.getFoldingRanges(sfcWithEmptyBlocksDocument);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (vueDocument) => {

                const sfcWithEmptyBlocks = getSfcCodeWithEmptyBlocks(vueDocument, document.getText());
                const sfcWithEmptyBlocksDocument = TextDocument.create(document.uri, document.languageId, document.version, sfcWithEmptyBlocks);

                return htmlLs.getSelectionRanges(sfcWithEmptyBlocksDocument, positions);
            });
        },

        format: undefined,
    };

    function worker<T>(document: TextDocument, callback: (vueDocument: SourceFile) => T) {

        const vueDocument = host.getVueDocument(document);
        if (!vueDocument)
            return;

        return callback(vueDocument);
    }

    function getHtmlDocument(document: TextDocument) {

        if (document.languageId !== 'vue')
            return;

        const cache = htmlDocuments.get(document);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === document.version) {
                return cacheDoc;
            }
        }

        const doc = htmlLs.parseHTMLDocument(document);
        htmlDocuments.set(document, [document.version, doc]);

        return doc;
    }
});

function getSfcCodeWithEmptyBlocks(vueDocument: SourceFile, sfcCode: string) {

    const descriptor = vueDocument.getDescriptor();
    const blocks = [
        descriptor.template, // relate to below
        descriptor.script,
        descriptor.scriptSetup,
        ...descriptor.styles,
        ...descriptor.customBlocks,
    ].filter(shared.notEmpty);

    // TODO: keep this for now and check why has this logic later
    // if (descriptor.template && descriptor.template.lang !== 'html') {
    //     blocks.push(descriptor.template);
    // }

    for (const block of blocks) {
        const content = sfcCode.substring(block.startTagEnd, block.startTagEnd + block.content.length);
        sfcCode = sfcCode.substring(0, block.startTagEnd)
            + content.split('\n').map(line => ' '.repeat(line.length)).join('\n')
            + sfcCode.substring(block.startTagEnd + block.content.length);
    }

    return sfcCode;
}
