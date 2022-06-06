import { VueLanguagePlugin } from '../vueFile';
import * as MarkdownIt from 'markdown-it';
// @ts-expect-error
import * as MarkdownItAst from 'markdown-it-ast';
import { SourceMapBase, Mode } from '@volar/source-map';
import { CodeGen } from '@volar/code-gen';

export default function (): VueLanguagePlugin {

	return {

		compileFileToVue(fileName, content) {

			if (fileName.endsWith('.md')) {

				let validTemplateBlock: [number, number] | undefined;
				let validScriptBlock: [number, number] | undefined;

				const scriptLines: [number, number][] = [];
				const templateLines: [number, number][] = [];

				const tokens = MarkdownIt().parse(content, {});
				const ast = MarkdownItAst.makeAST(tokens);

				for (const node of ast) {
					// <script> block start tag
					if (
						node.nodeType === 'paragraph'
						&& node.children.length
						&& node.children[0].type === 'inline' && (node.children[0].content.startsWith('<script ') || node.children[0].content.startsWith('<script>'))
					) {
						breakTemplateBlock();
						validScriptBlock = node.children[0].map;
					}
					// <script> block end tag
					if (
						validScriptBlock
						&& node.nodeType === 'paragraph'
						&& node.children.length
						&& node.children[0].type === 'inline' && node.children[0].content.indexOf('</script>') >= 0
					) {
						validScriptBlock[1] = node.children[0].map[1];
						scriptLines.push(validScriptBlock);
						validScriptBlock = undefined;
					}
					else if (!validScriptBlock) {
						walkNode(node);
					}
				}

				breakTemplateBlock();

				const codeGen = new CodeGen();
				const lines = content.split('\n');
				const lineOffsets: number[] = [];
				let lineOffset = 0;

				for (const line of lines) {
					lineOffsets.push(lineOffset);
					lineOffset += line.length + 1;
				}

				for (const _scriptLines of scriptLines) {
					const rangeLines = lines.slice(_scriptLines[0], _scriptLines[1]);
					const rangeCode = rangeLines.join('\n');
					const start = lineOffsets[_scriptLines[0]];
					codeGen.addCode(
						rangeCode,
						{
							start: start,
							end: start + rangeCode.length,
						},
						Mode.Offset,
						undefined,
					);
				}

				if (templateLines.length) {
					codeGen.addText('\n<template>\n');
					for (const _templateLines of templateLines) {
						const rangeLines = lines.slice(_templateLines[0], _templateLines[1]);
						const rangeCode = rangeLines.join('\n');
						const start = lineOffsets[_templateLines[0]];
						codeGen.addCode(
							rangeCode,
							{
								start: start,
								end: start + rangeCode.length,
							},
							Mode.Offset,
							undefined,
						);
						codeGen.addText('\n');
					}
					codeGen.addText('\n</template>\n');
				}

				const sourceMap = new SourceMapBase(codeGen.getMappings());

				return {
					vue: codeGen.getText(),
					mapping: vueRange => sourceMap.getSourceRange(vueRange.start, vueRange.end)?.[0],
					sourceMap, // for create virtual embedded vue file
				};

				function walkNode(node: any) {
					// ignore ``` block
					if (node.type === 'fence') {
						breakTemplateBlock();
						return false;
					}
					let shouldAddRange = true;
					if (node.children) {
						for (const child of node.children) {
							shouldAddRange = shouldAddRange && walkNode(child);
						}
					}
					if (shouldAddRange) {
						const map = node.map ?? node.openNode?.map;
						if (map) {
							addValidTemplateBlockRange(map);
						}
					}
					return true;
				}
				function breakTemplateBlock() {
					if (validTemplateBlock) {
						templateLines.push(validTemplateBlock);
						validTemplateBlock = undefined;
					}
				}
				function addValidTemplateBlockRange(range: [number, number]) {
					if (!validTemplateBlock) {
						validTemplateBlock = [range[0], range[1]];
					}
					else {
						validTemplateBlock[1] = range[1];
					}
				}
			}
		}
	};
}
