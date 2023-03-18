import { LanguageServicePlugin } from '@volar/language-service';
import { forEachEmbeddedFile, VirtualFile, VueFile } from '@volar/vue-language-core';
import { join } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';
// import * as vscode from 'vscode-languageserver-protocol';
import dedent = require('string-dedent');

export default function (): LanguageServicePlugin {

	return (ctx) => {

		return {

			provideCodeActions(document, range, _context) {
				const startOffset = document.offsetAt(range.start);
				const endOffset = document.offsetAt(range.end);
				if (startOffset === endOffset || !document.uri.endsWith('.vue')) return;
				// if (context.triggerKind !== 1) return
				const [virtualFile, source] = ctx!.documents.getVirtualFileByUri(document.uri + '.ts');
				if (!source) return;
				// require explicit whole tag selection
				const { templateAst, template, script, scriptSetup } = (source.root as VueFile).sfc;
				// todo both can be defined, pick nearest
				const scriptStartOffset = script?.startTagEnd ?? scriptSetup?.startTagEnd!;
				// todo handle when both null scripts
				if (!templateAst) return;
				type Children = typeof templateAst.children;

				const templateStartOffset = template!.startTagEnd;
				function find(children: Children): Children[number] | void {
					for (const child of children) {
						const {
							start: { offset: start },
							end: { offset: end },
						} = child.loc;
						if (start + templateStartOffset >= startOffset && end + templateStartOffset <= endOffset) {
							if (start + templateStartOffset === startOffset && end + templateStartOffset === endOffset) return child;
							if ('children' in child && typeof child.children === 'object' && Array.isArray(child.children)) {
								return find(child.children as typeof child.children & any[]) ?? child;
							} else {
								return child;
							}
						}
					}
				}
				const templateNode = find(templateAst.children);
				if (!templateNode) return;
				const isExactTagSelection = () => {
					const {
						start: { offset: start },
						end: { offset: end },
					} = templateNode.loc;
					return start + templateStartOffset === startOffset && end + templateStartOffset === endOffset;
				};
				if (!isExactTagSelection()) return;
				let templateFormatScript: VirtualFile | undefined;
				forEachEmbeddedFile(source.root, embedded => {
					if (embedded.fileName.endsWith('.template_format.ts')) {
						templateFormatScript = embedded;
					}
				});
				if (!templateFormatScript) return;
				const appliableMappings = templateFormatScript.mappings.filter(mapping => {
					const [start, end] = mapping.sourceRange;
					return start > startOffset && end < endOffset;
				});
				const isRangeInside = (outerRange: [number, number], innerRange: [number, number]) => {
					const [outerStart, outerEnd] = outerRange;
					const [innerStart, innerEnd] = innerRange;
					return innerStart >= outerStart && innerEnd <= outerEnd;
				};
				const ranges = appliableMappings.map(({ sourceRange }) => {
					return virtualFile.mappings
						.filter(mapping => isRangeInside(sourceRange, mapping.sourceRange))
						.filter(({ generatedRange: [start, end] }) => !!virtualFile.snapshot.getText(start, end).trim());
				});
				const typescript = ctx!.typescript!;
				const ts = typescript.module;
				const sourceFile = typescript.languageService.getProgram()!.getSourceFile(virtualFile.fileName)!;
				const compact = <T>(arr: (T | undefined)[]) => arr.filter(Boolean) as T[];
				const handledProps = new Set<string>();
				const toExtract = compact(
					ranges.flatMap(generatedRanges => {
						const nodes = generatedRanges.map(({ generatedRange }) => {
							return findChildContainingPosition(ts, sourceFile, generatedRange[0]);
						}).filter(node => node && !ts.isArrayLiteralExpression(node));
						return nodes.map(node => {
							if (!node || !ts.isIdentifier(node)) return;
							const name = node.text;
							if (handledProps.has(name)) return;
							handledProps.add(name);
							const checker = typescript.languageService.getProgram()!.getTypeChecker()!;
							const type = checker.getTypeAtLocation(node);
							const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
							const typeString = checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation);
							return {
								name,
								type: typeString.startsWith('__VLS_') ? 'any' : typeString,
								isMethod: signatures.length > 0,
							};
						});
					}),
				);
				const props = toExtract.filter(e => !e.isMethod);
				const propTypes = props.map(p => `${p.name}: ${p.type}`);
				const propNames = props.map(p => p.name);
				const emits = toExtract.filter(e => e.isMethod);
				const emitTypes = emits.map(p => `${p.name}: ${p.type}`);
				const emitNames = emits.map(p => p.name);
				const newFileContents = (dedent as any)`
					<script setup lang="ts">
					const { ${propNames.join(', ')} } = defineProps<{
						${propTypes.join('\n\t\t')}
					}>()
					const { ${emitNames.join(', ')} } = defineEmits<{
						${emitTypes.join('\n\t\t')}
					}>()
					</script>
					<template>
						${templateNode.loc.source}
					</template>
					`;
				let lastImportNode: ts.Node = sourceFile;

				for (const statement of sourceFile.statements) {
					if (ts.isImportDeclaration(statement)) {
						lastImportNode = statement;
					} else {
						break;
					}
				}
				const extractedComponentName = `Extracted`;
				const extractedFileName = `${extractedComponentName}.vue`;
				const newUri = join(document.uri, '..', extractedFileName);
				return [
					{
						title: 'Extract into new dumb component',
						kind: 'refactor.move.newFile.dumb',
						edit: {
							changes: {
								[document.uri]: [
									{
										range: {
											start: document.positionAt(templateStartOffset + templateNode.loc.start.offset),
											end: document.positionAt(templateStartOffset + templateNode.loc.end.offset),
										},
										newText: `<${extractedComponentName} ${propNames.map(p => `:${p}="${p}"`).join(' ')} ${emitNames
											.map(p => `@${p}="${p}"`)
											.join(' ')} />`,
									},
									{
										range: {
											start: document.positionAt(scriptStartOffset + lastImportNode.end),
											end: document.positionAt(scriptStartOffset + lastImportNode.end),
										},
										newText: `\nimport ${extractedComponentName} from './${extractedFileName}'`,
									},
								],
								[newUri]: [
									{
										range: {
											start: {
												line: 0,
												character: 0,
											},
											end: {
												line: 0,
												character: 0,
											},
										},
										newText: newFileContents,
									},
								],
							},
							// documentChanges: [
							// 	{
							// 		kind: 'create',
							// 		uri: newUri,
							// 	},
							// ],
						},
					},
				];
			},
		};

	};
}

function findChildContainingPosition(typescript: typeof import("typescript/lib/tsserverlibrary"), sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
	function find(node: ts.Node): ts.Node | undefined {
		if (position >= node.getStart() && position < node.getEnd()) {
			return typescript.forEachChild(node, find) || node;
		}

		return;
	}
	return find(sourceFile);
}
