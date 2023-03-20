import { LanguageServicePlugin } from '@volar/language-service';
import { forEachEmbeddedFile, VirtualFile, VueFile, walkElementNodes } from '@volar/vue-language-core';
import { ElementNode } from 'packages/vue-language-core/src/utils/vue2TemplateCompiler';
import { join } from 'path';
import type * as ts from 'typescript/lib/tsserverlibrary';

export default function (): LanguageServicePlugin {

	return (ctx) => {

		return {

			async provideCodeActions(document, range, _context) {

				const startOffset = document.offsetAt(range.start);
				const endOffset = document.offsetAt(range.end);
				if (startOffset === endOffset) {
					return;
				}

				const [vueFile] = ctx!.documents.getVirtualFileByUri(document.uri);
				if (!vueFile || !(vueFile instanceof VueFile)) {
					return;
				}

				let virtualFile: VirtualFile | undefined;

				forEachEmbeddedFile(vueFile, embedded => {
					if (embedded.fileName === vueFile.mainScriptName) {
						virtualFile = embedded;
					}
				});
				if (!virtualFile) {
					return;
				}

				const { templateAst, template, script, scriptSetup } = vueFile.sfc;
				const scriptStartOffset = scriptSetup?.startTagEnd ?? script?.startTagEnd!;
				if (!templateAst) return;

				const templateStartOffset = template!.startTagEnd;

				let templateNode: ElementNode | undefined;
				walkElementNodes(templateAst, (node) => {
					const {
						start: { offset: start },
						end: { offset: end },
					} = node.loc;
					if (start + templateStartOffset === startOffset && end + templateStartOffset === endOffset) {
						templateNode = node;
					}
				});
				if (!templateNode) return;
				const isExactTagSelection = () => {
					const {
						start: { offset: start },
						end: { offset: end },
					} = templateNode!.loc;
					return start + templateStartOffset === startOffset && end + templateStartOffset === endOffset;
				};
				if (!isExactTagSelection()) return;
				let templateFormatScript: VirtualFile | undefined;
				forEachEmbeddedFile(vueFile, embedded => {
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
				const interpolationRanges = virtualFile && appliableMappings.map(({ sourceRange }) => {
					return virtualFile!.mappings
						.filter(mapping => isRangeInside(sourceRange, mapping.sourceRange))
						.filter(({ generatedRange: [start, end] }) => !!virtualFile!.snapshot.getText(start, end).trim());
				});
				const { languageService, languageServiceHost } = ctx!.typescript!;
				const ts = ctx!.typescript!.module;
				const sourceFile = virtualFile && languageService.getProgram()!.getSourceFile(virtualFile.fileName)!;
				const sourceFileKind = virtualFile && languageServiceHost.getScriptKind?.(virtualFile.fileName);
				const handledProps = new Set<string>();
				const toExtract = interpolationRanges && compact(
					interpolationRanges.flatMap(generatedRanges => {
						const nodes = generatedRanges.map(({ generatedRange }) => {
							return findTypeScriptNode(ts, sourceFile, generatedRange[0]);
						}).filter(node => node && !ts.isArrayLiteralExpression(node));
						return nodes.map(node => {
							if (!node || !ts.isIdentifier(node)) return;
							const name = node.text;
							if (handledProps.has(name)) return;
							handledProps.add(name);
							const checker = languageService.getProgram()!.getTypeChecker()!;
							const type = checker.getTypeAtLocation(node);
							const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
							const typeString = checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation);
							return {
								name,
								type: typeString.includes('__VLS_') ? 'any' : typeString,
								isMethod: signatures.length > 0,
							};
						});
					}),
				);
				const props = toExtract?.filter(e => !e.isMethod);
				const propTypes = props.map(p => `${p.name}: ${p.type}`);
				const propNames = props.map(p => p.name);
				const emits = toExtract?.filter(e => e.isMethod);
				const emitTypes = emits.map(p => `${p.name}: ${p.type}`);
				const emitNames = emits.map(p => p.name);
				const scriptAttributes = compact([
					scriptSetup && 'setup',
					`lang="${sourceFileKind === ts.ScriptKind.JS ? 'js' : sourceFileKind === ts.ScriptKind.TSX ? 'tsx' : 'ts'}"`
				]);
				const scriptContents = compact([
					props?.length && `const { ${propNames.join(', ')} } = defineProps<{ \n\t${propTypes.join('\n\t\t')}\n}>()`,
					emits?.length && `const { ${emitNames.join(', ')} } = defineEmits<{ \n\t${emitTypes.join('\n\t\t')}\n}>()`
				]);

				const initialIndentSetting = await ctx!.configurationHost!.getConfiguration('volar.format.initialIndent') as Record<string, boolean>;

				const newScriptTag = scriptContents.length
					? constructTag('script', scriptAttributes, isInitialIndentNeeded(ts, sourceFileKind!, initialIndentSetting), scriptContents.join('\n'))
					: '';

				const newTemplateTag = constructTag('template', [], initialIndentSetting.html, templateNode.loc.source);

				const newFileContents = dedentString(templateStartOffset > scriptStartOffset ? `${newScriptTag}${newTemplateTag}` : `${newTemplateTag}${newScriptTag}`);
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

function findTypeScriptNode(ts: typeof import("typescript/lib/tsserverlibrary"), sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
	function find(node: ts.Node): ts.Node | undefined {
		if (position >= node.getStart() && position < node.getEnd()) {
			return ts.forEachChild(node, find) || node;
		}

		return;
	}
	return find(sourceFile);
}

/** Also removes leading empty lines */
function dedentString(input: string) {
	let lines = input.split(/\n/g);
	const firstNonEmptyLineIndex = lines.findIndex(line => line) ?? 0;
	lines = lines.slice(firstNonEmptyLineIndex);
	const initialIndentation = lines[0]!.match(/\s*/)![0];
	return lines.map(line => initialIndentation && line.startsWith(initialIndentation) ? line.slice(initialIndentation.length) : line).join('\n');
}

function compact<T>(arr: (T | undefined | null | false | 0)[]) {
	return arr.filter(Boolean) as T[];
}

function constructTag(name: string, attributes: string[], initialIndent: boolean, content: string) {
	if (initialIndent) content = content.split('\n').map(line => `\t${line}`).join('\n');
	const attributesString = attributes.length ? ` ${attributes.join(' ')}` : '';
	return `<${name}${attributesString}>\n${content}\n</${name}>\n`;
}

function isInitialIndentNeeded(ts: typeof import("typescript/lib/tsserverlibrary"), languageKind: ts.ScriptKind, initialIndentSetting: Record<string, boolean>) {
	const languageKindIdMap = {
		[ts.ScriptKind.JS]: 'javascript',
		[ts.ScriptKind.TS]: 'typescript',
		[ts.ScriptKind.JSX]: 'javascriptreact',
		[ts.ScriptKind.TSX]: 'typescriptreact',
	} as Record<ts.ScriptKind, string>;
	return initialIndentSetting[languageKindIdMap[languageKind]] ?? true;
}
