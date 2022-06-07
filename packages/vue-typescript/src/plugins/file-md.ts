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
				let validStyleBlock: [number, number] | undefined;

				const scriptLines: [number, number][] = [];
				const styleLines: [number, number][] = [];
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
						continue;
					}
					if (validScriptBlock) {
						continue;
					}
					// <style> block start tag
					if (
						node.nodeType === 'paragraph'
						&& node.children.length
						&& node.children[0].type === 'inline' && (node.children[0].content.startsWith('<style ') || node.children[0].content.startsWith('<style>'))
					) {
						breakTemplateBlock();
						validStyleBlock = node.children[0].map;
					}
					// <style> block end tag
					if (
						validStyleBlock
						&& node.nodeType === 'paragraph'
						&& node.children.length
						&& node.children[0].type === 'inline' && node.children[0].content.indexOf('</style>') >= 0
					) {
						validStyleBlock[1] = node.children[0].map[1];
						styleLines.push(validStyleBlock);
						validStyleBlock = undefined;
						continue;
					}
					if (validStyleBlock) {
						continue;
					}
					walkNode(node);
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

				for (const _lines of scriptLines) {
					const rangeLines = lines.slice(_lines[0], _lines[1]);
					const rangeCode = rangeLines.join('\n');
					const start = lineOffsets[_lines[0]];
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

				for (const _lines of styleLines) {
					const rangeLines = lines.slice(_lines[0], _lines[1]);
					const rangeCode = rangeLines.join('\n');
					const start = lineOffsets[_lines[0]];
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
					for (const _lines of templateLines) {
						const rangeLines = lines.slice(_lines[0], _lines[1]);
						const rangeCode = rangeLines.join('\n');
						const start = lineOffsets[_lines[0]];
						codeGen.addCode(
							rangeCode
								// inline code block
								.replace(/\`([\s\S]*?)\`/g, match => `\`${' '.repeat(match.length - 2)}\``)
								// # \<script setup>
								.replace(/\\\<([\s\S]*?)\n?/g, match => ' '.repeat(match.length))
								// markdown line
								.replace(/\[([\s\S]*?)\]\(([\s\S]*?)\)/g, match => ' '.repeat(match.length)),
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
