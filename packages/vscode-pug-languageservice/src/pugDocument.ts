import { uriToFsPath } from '@volar/shared';
import * as SourceMap from '@volar/source-map';
import * as path from 'upath';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createCodeGen } from '@volar/code-gen';

const pugLex = require('pug-lexer');
const pugParser = require('pug-parser');

export type PugDocument = ReturnType<typeof parsePugDocument>;

export function parsePugDocument(pugTextDoc: TextDocument, htmlLs: html.LanguageService) {

    const fsPath = uriToFsPath(pugTextDoc.uri);
    const fileName = path.basename(fsPath);
    const pugCode = pugTextDoc.getText();
    const codeGen = createCodeGen<undefined>();
    let error: {
        code: string,
        msg: string,
        line: number,
        column: number,
        filename: string,
    } | undefined;

    try {
        const tokens = pugLex(pugCode, { filename: fileName });
        const ast = pugParser(tokens, { filename: fileName, src: pugCode });
        visitNode(ast, undefined);
        codeGen.addMapping2({
            data: undefined,
            mode: SourceMap.Mode.Totally,
            sourceRange: {
                start: pugCode.trimEnd().length,
                end: pugCode.trimEnd().length,
            },
            mappedRange: {
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
    const htmlTextDoc = TextDocument.create(pugTextDoc.uri + '.html', 'html', pugTextDoc.version, htmlCode);
    const sourceMap = new SourceMap.SourceMap(pugTextDoc, htmlTextDoc, codeGen.getMappings());

    return {
        pugTextDocument: pugTextDoc,
        htmlTextDocument: htmlTextDoc,
        htmlDocument: htmlLs.parseHTMLDocument(htmlTextDoc),
        pugCode,
        htmlCode,
        sourceMap,
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
            addStartTag(node, selfClosing);
            if (!selfClosing) {
                visitNode(node.block, next);
                addEndTag(node, next);
            }
        }
        else if (node.type === 'Text') {
            codeGen.addCode(
                node.val,
                getDocRange(node.line, node.column, node.val.length),
                SourceMap.Mode.Offset,
                undefined,
            );
        }
    }
    function addStartTag(node: TagNode, selfClosing: boolean) {
        codeGen.addMapping2({
            data: undefined,
            mode: SourceMap.Mode.Totally,
            sourceRange: getDocRange(node.line, node.column, 0),
            mappedRange: {
                start: codeGen.getText().length,
                end: codeGen.getText().length,
            },
        });
        codeGen.addText('<');
        const tagRange = getDocRange(node.line, node.column, node.name.length);
        if (pugCode.substring(tagRange.start, tagRange.end) === node.name) {
            codeGen.addCode(
                node.name,
                tagRange,
                SourceMap.Mode.Offset,
                undefined,
            );
        }
        else {
            codeGen.addText(node.name);
        }
        addClassesOrStyles(node.attrs, 'class');
        for (const attr of node.attrs.filter(attr => attr.name !== 'class')) {
            addAttr(attr);
        }
        if (selfClosing) {
            codeGen.addText(' />');
        }
        else {
            codeGen.addText('>');
        }
    }
    function addAttr(attr: TagNode['attrs'][number]) {
        codeGen.addText(' ');
        if (attr.mustEscape) {
            codeGen.addCode(
                attr.name,
                getDocRange(attr.line, attr.column, attr.name.length),
                SourceMap.Mode.Offset,
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
            val = val.replace(/ \\\n/g, '//\n'); // TODO: required a space for now
            codeGen.addCode(
                val,
                getDocRange(attr.line, attr.column, val.length, escapeLength),
                SourceMap.Mode.Offset,
                undefined
            );
        }
    }
    function addEndTag(node: TagNode, next: Node | undefined) {
        let nextStart = pugCode.length;
        if (next) {
            if (next.type === 'Block') {
                nextStart = getDocOffset(next.line, 1);
            }
            else {
                nextStart = getDocOffset(next.line, next.column);
            }
        }
        codeGen.addMapping2({
            data: undefined,
            mode: SourceMap.Mode.Totally,
            sourceRange: {
                start: nextStart,
                end: nextStart,
            },
            mappedRange: {
                start: codeGen.getText().length,
                end: codeGen.getText().length,
            },
        })
        codeGen.addText(`</${node.name}>`);
    }
    function addClassesOrStyles(classes: TagNode['attrs'], attrName: string) {
        codeGen.addText(' ');
        for (const attr of classes) {
            if (attr.name === attrName && attr.mustEscape) {
                codeGen.addMapping2({
                    data: undefined,
                    mode: SourceMap.Mode.Offset,
                    sourceRange: getDocRange(attr.line, attr.column, attrName.length),
                    mappedRange: {
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
                    getDocRange(attr.line, attr.column + 1, attr.val.length - 2, escapeLength),
                    SourceMap.Mode.Offset,
                    undefined
                );
            }
        }
        codeGen.addText('"');
    }
    function getDocOffset(pugLine: number, pugColumn: number) {
        return pugTextDoc.offsetAt({ line: pugLine - 1, character: pugColumn - 1 });
    }
    function getDocRange(pugLine: number, pugColumn: number, length: number, offset = 0) {
        const start = pugTextDoc.offsetAt({ line: pugLine - 1, character: pugColumn - 1 }) + offset;
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
