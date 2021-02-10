import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@volar/shared';
import { createScriptGenerator, MapedMode, SourceMap } from '@volar/source-map';
import * as html from 'vscode-html-languageservice';
import * as path from 'upath';

const lex = require('pug-lexer');
const parse = require('pug-parser');

export type PugDocument = ReturnType<typeof parsePugDocument>;

export function parsePugDocument(document: TextDocument, htmlLanguageService: html.LanguageService) {

    const fsPath = uriToFsPath(document.uri);
    const filename = path.basename(fsPath);
    const src = document.getText();
    const codeGen = createScriptGenerator<undefined>();
    let error: { code: string, msg: string, line: number, column: number, filename: string } | undefined;

    try {
        const tokens = lex(src, { filename });
        const ast = parse(tokens, { filename, src });
        visitNode(ast, undefined);
        codeGen.addMapping2({
            data: undefined,
            mode: MapedMode.Gate,
            sourceRange: {
                start: src.trimEnd().length,
                end: src.trimEnd().length,
            },
            targetRange: {
                start: codeGen.getText().length,
                end: codeGen.getText().length,
            },
        })
    }
    catch (_error) {
        error = {
            ..._error,
            line: _error.line - 1,
            column: _error.column - 1,
        };
    };

    const htmlCode = codeGen.getText();
    const htmlDoc = TextDocument.create(document.uri + '.html', 'html', document.version, htmlCode);
    const sourceMap = new SourceMap<undefined>(document, htmlDoc);
    for (const mapping of codeGen.getMappings()) {
        sourceMap.add(mapping);
    }
    const htmlDocument = htmlLanguageService.parseHTMLDocument(htmlDoc);

    return {
        pug: src,
        html: htmlCode,
        sourceMap,
        htmlDocument,
        error,
    };

    function visitNode(node: Node, next: Node | undefined) {
        if (node.type === 'Block') {
            for (let i = 0; i < node.nodes.length; i++) {
                visitNode(node.nodes[i], node.nodes[i + 1]);
            }
        }
        else if (node.type === 'Tag') {
            const selfClosing = node.block.nodes.length === 0;
            writeStartTag(node, selfClosing);
            if (!selfClosing) {
                visitNode(node.block, next);
                writeEndTag(node, next);
            }
        }
        else if (node.type === 'Text') {
            codeGen.addCode(
                node.val,
                getPugStartEnd(node.line, node.column, node.val.length),
                MapedMode.Offset,
                undefined,
            );
        }
    }
    function writeStartTag(node: TagNode, selfClosing: boolean) {
        codeGen.addMapping2({
            data: undefined,
            mode: MapedMode.Gate,
            sourceRange: getPugStartEnd(node.line, node.column, 0),
            targetRange: {
                start: codeGen.getText().length,
                end: codeGen.getText().length,
            },
        });
        codeGen.addText('<');
        codeGen.addCode(
            node.name,
            getPugStartEnd(node.line, node.column, node.name.length),
            MapedMode.Offset,
            undefined,
        );
        writeClassesOrStyles(node.attrs, 'class');
        for (const attr of node.attrs.filter(attr => attr.name !== 'class')) {
            writeAttr(attr);
        }
        if (selfClosing) {
            codeGen.addText(' />');
        }
        else {
            codeGen.addText('>');
        }
    }
    function writeAttr(attr: TagNode['attrs'][0]) {
        codeGen.addText(' ');
        if (attr.mustEscape) {
            codeGen.addCode(
                attr.name,
                getPugStartEnd(attr.line, attr.column, attr.name.length),
                MapedMode.Offset,
                undefined
            );
        }
        else {
            codeGen.addText(attr.name);
        }
        if (typeof attr.val !== 'boolean') {
            codeGen.addText('=');
            const escapeLength = attr.mustEscape ? `${attr.name}=`.length : 0;
            let val = attr.val;
            if (val.startsWith('`') && val.endsWith('`')) {
                val = `"${val.substr(1, val.length - 2)}"`;
            }
            codeGen.addCode(
                val,
                getPugStartEnd(attr.line, attr.column, val.length, escapeLength),
                MapedMode.Offset,
                undefined
            );
        }
    }
    function writeClassesOrStyles(classes: TagNode['attrs'], attrName: string) {
        codeGen.addText(' ');
        for (const attr of classes) {
            if (attr.name === attrName && attr.mustEscape) {
                codeGen.addMapping2({
                    data: undefined,
                    mode: MapedMode.Offset,
                    sourceRange: getPugStartEnd(attr.line, attr.column, attrName.length),
                    targetRange: {
                        start: codeGen.getText().length,
                        end: codeGen.getText().length + attrName.length,
                    },
                });
            }
        }
        codeGen.addText(attrName);
        codeGen.addText('=');
        codeGen.addText('"');
        for (const attr of classes) {
            if (attr.name === attrName && typeof attr.val !== 'boolean') {
                codeGen.addText(' ');
                const escapeLength = attr.mustEscape ? `${attrName}=`.length : 0;
                codeGen.addCode(
                    attr.val.substr(1, attr.val.length - 2), // remove "
                    getPugStartEnd(attr.line, attr.column + 1, attr.val.length - 2, escapeLength),
                    MapedMode.Offset,
                    undefined
                );
            }
        }
        codeGen.addText('"');
    }
    function writeEndTag(node: TagNode, next: Node | undefined) {
        let nextStart = src.length;
        if (next) {
            if (next.type === 'Block') {
                nextStart = getPugOffset(next.line, 1);
            }
            else {
                nextStart = getPugOffset(next.line, next.column);
            }
        }
        codeGen.addMapping2({
            data: undefined,
            mode: MapedMode.Gate,
            sourceRange: {
                start: nextStart,
                end: nextStart,
            },
            targetRange: {
                start: codeGen.getText().length,
                end: codeGen.getText().length,
            },
        })
        codeGen.addText(`</${node.name}>`);
    }
    function getPugOffset(line: number, column: number, offset = 0) {
        return document.offsetAt({ line: line - 1, character: column - 1 }) + offset;
    }
    function getPugStartEnd(line: number, column: number, length: number, offset = 0) {
        const start = document.offsetAt({ line: line - 1, character: column - 1 }) + offset;
        const end = start + length;
        return {
            start,
            end,
        };
    }
}

type Node = BlockNode | TagNode | TextNode;

type BlockNode = {
    type: 'Block',
    nodes: Node[],
    line: number,
}
type TagNode = {
    type: 'Tag',
    name: string,
    selfClosing: boolean,
    block: BlockNode,
    attrs: {
        name: string,
        val: string | true,
        line: number,
        column: number,
        mustEscape: boolean,
    }[],
    attributeBlocks: {
        // ?
    }[],
    isInline: boolean,
    line: number,
    column: number,
}
type TextNode = {
    type: 'Text',
    val: string,
    line: number,
    column: number,
}