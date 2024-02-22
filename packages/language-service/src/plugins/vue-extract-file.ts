import { CreateFile, ServicePlugin, TextDocumentEdit, TextEdit } from '@volar/language-service';
import { ExpressionNode, type TemplateChildNode } from '@vue/compiler-dom';
import { Sfc, SourceFile, VueGeneratedCode, isSemanticTokensEnabled, scriptRanges } from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { Provide } from 'volar-service-typescript';
import type * as vscode from 'vscode-languageserver-protocol';

interface ActionData {
	uri: string;
	range: [number, number];
	newName: string;
}

const unicodeReg = /\\u/g;

export function create(ts: typeof import('typescript/lib/tsserverlibrary')): ServicePlugin {
	return {
		name: 'vue-extract-file',
		create(context) {
			return {
				async provideCodeActions(document, range, _context) {

					const startOffset = document.offsetAt(range.start);
					const endOffset = document.offsetAt(range.end);
					if (startOffset === endOffset) {
						return;
					}

					const [vueFile] = context.documents.getVirtualCodeByUri(document.uri);
					if (!vueFile || !(vueFile instanceof VueGeneratedCode))
						return;

					const { sfc } = vueFile;
					const script = sfc.scriptSetup ?? sfc.script;

					if (!sfc.template || !script)
						return;

					const templateCodeRange = selectTemplateCode(startOffset, endOffset, sfc.template);
					if (!templateCodeRange)
						return;

					return [
						{
							title: 'Extract into new dumb component',
							kind: 'refactor.move.newFile.dumb',
							data: {
								uri: document.uri,
								range: [startOffset, endOffset],
								newName: 'NewComponent',
							} satisfies ActionData,
						},
					];
				},

				async resolveCodeAction(codeAction) {

					const { uri, range, newName } = codeAction.data as ActionData;
					const [startOffset, endOffset]: [number, number] = range;
					const [vueCode, fileSource] = context.documents.getVirtualCodeByUri(uri) as [VueGeneratedCode, SourceFile];
					const document = context.documents.get(uri, vueCode.languageId, vueCode.snapshot)!;
					const { sfc } = vueCode;
					const script = sfc.scriptSetup ?? sfc.script;

					if (!sfc.template || !script)
						return codeAction;

					const templateCodeRange = selectTemplateCode(startOffset, endOffset, sfc.template);
					if (!templateCodeRange)
						return codeAction;

					const languageService = context.inject<Provide, 'typescript/languageService'>('typescript/languageService');
					const sourceFile = languageService.getProgram()!.getSourceFile(vueCode.fileName)!;
					const toExtract = collectExtractProps();
					const templateInitialIndent = await context.env.getConfiguration!<boolean>('vue.format.initialIndent.template') ?? true;
					const scriptInitialIndent = await context.env.getConfiguration!<boolean>('vue.format.initialIndent.script') ?? true;
					const newUri = document.uri.substring(0, document.uri.lastIndexOf('/') + 1) + `${newName}.vue`;
					const lastImportNode = getLastImportNode(ts, script.ast);

					let newFileTags = [];

					newFileTags.push(
						constructTag('template', [], templateInitialIndent, sfc.template.content.substring(templateCodeRange[0], templateCodeRange[1]))
					);

					if (toExtract.length) {
						newFileTags.push(
							constructTag('script', ['setup', 'lang="ts"'], scriptInitialIndent, generateNewScriptContents())
						);
					}
					if (sfc.template.startTagEnd > script.startTagEnd) {
						newFileTags = newFileTags.reverse();
					}

					const currentFileEdits: vscode.TextEdit[] = [
						{
							range: {
								start: document.positionAt(sfc.template.startTagEnd + templateCodeRange[0]),
								end: document.positionAt(sfc.template.startTagEnd + templateCodeRange[1]),
							},
							newText: generateReplaceTemplate(),
						},
						{
							range: lastImportNode ? {
								start: document.positionAt(script.startTagEnd + lastImportNode.end),
								end: document.positionAt(script.startTagEnd + lastImportNode.end),
							} : {
								start: document.positionAt(script.startTagEnd),
								end: document.positionAt(script.startTagEnd),
							},
							newText: `\nimport ${newName} from './${newName}.vue'`,
						},
					];

					if (sfc.script) {
						const edit = createAddComponentToOptionEdit(ts, sfc.script.ast, newName);
						if (edit) {
							currentFileEdits.push({
								range: {
									start: document.positionAt(sfc.script.startTagEnd + edit.range.start),
									end: document.positionAt(sfc.script.startTagEnd + edit.range.end),
								},
								newText: edit.newText,
							});
						}
					}

					return {
						...codeAction,
						edit: {
							documentChanges: [
								// editing current file
								{
									textDocument: {
										uri: document.uri,
										version: null,
									},
									edits: currentFileEdits,
								} satisfies TextDocumentEdit,

								// creating new file with content
								{
									uri: newUri,
									kind: 'create',
								} satisfies CreateFile,
								{
									textDocument: {
										uri: newUri,
										version: null,
									},
									edits: [
										{
											range: {
												start: { line: 0, character: 0 },
												end: { line: 0, character: 0 },
											},
											newText: newFileTags.join('\n'),
										} satisfies TextEdit,
									],
								} satisfies TextDocumentEdit,
							],
						},
					};

					function collectExtractProps() {

						const result = new Map<string, {
							name: string;
							type: string;
							model: boolean;
						}>();
						const checker = languageService.getProgram()!.getTypeChecker();
						const script = fileSource.generated?.languagePlugin.typescript?.getScript(vueCode);
						const maps = script ? [...context.documents.getMaps(script.code)] : [];

						sourceFile.forEachChild(function visit(node) {
							if (
								ts.isPropertyAccessExpression(node)
								&& ts.isIdentifier(node.expression)
								&& node.expression.text === '__VLS_ctx'
								&& ts.isIdentifier(node.name)
							) {
								const { name } = node;
								for (const map of maps) {
									const source = map.map.getSourceOffset(name.getEnd());
									if (
										source
										&& source[0] >= sfc.template!.startTagEnd + templateCodeRange![0]
										&& source[0] <= sfc.template!.startTagEnd + templateCodeRange![1]
										&& isSemanticTokensEnabled(source[1].data)
									) {
										if (!result.has(name.text)) {
											const type = checker.getTypeAtLocation(node);
											const typeString = checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation);
											result.set(name.text, {
												name: name.text,
												type: typeString.includes('__VLS_') ? 'any' : typeString,
												model: false,
											});
										}
										const isModel = ts.isPostfixUnaryExpression(node.parent) || ts.isBinaryExpression(node.parent);
										if (isModel) {
											result.get(name.text)!.model = true;
										}
										break;
									}
								}
							}
							node.forEachChild(visit);
						});

						return [...result.values()];
					}

					function generateNewScriptContents() {
						const lines = [];
						const props = [...toExtract.values()].filter(p => !p.model);
						const models = [...toExtract.values()].filter(p => p.model);
						if (props.length) {
							lines.push(`defineProps<{ \n\t${props.map(p => `${p.name}: ${p.type};`).join('\n\t')}\n}>()`);
						}
						for (const model of models) {
							lines.push(`const ${model.name} = defineModel<${model.type}>('${model.name}', { required: true })`);
						}
						return lines.join('\n');
					}

					function generateReplaceTemplate() {
						const props = [...toExtract.values()].filter(p => !p.model);
						const models = [...toExtract.values()].filter(p => p.model);
						return [
							`<${newName}`,
							...props.map(p => `:${p.name}="${p.name}"`),
							...models.map(p => `v-model:${p.name}="${p.name}"`),
							`/>`,
						].join(' ');
					}
				},

				transformCodeAction(item) {
					return item; // ignore mapping
				},
			};
		},
	};
}

function selectTemplateCode(startOffset: number, endOffset: number, templateBlock: NonNullable<Sfc['template']>) {

	if (startOffset < templateBlock.startTagEnd || endOffset > templateBlock.endTagStart)
		return;

	const insideNodes: (TemplateChildNode | ExpressionNode)[] = [];

	templateBlock.ast?.children.forEach(function visit(node: TemplateChildNode | ExpressionNode) {
		if (
			node.loc.start.offset + templateBlock.startTagEnd >= startOffset
			&& node.loc.end.offset + templateBlock.startTagEnd <= endOffset
		) {
			insideNodes.push(node);
		}
		if ('children' in node) {
			node.children.forEach(node => {
				if (typeof node === 'object') {
					visit(node);
				}
			});
		}
		else if ('branches' in node) {
			node.branches.forEach(visit);
		}
		else if ('content' in node) {
			if (typeof node.content === 'object') {
				visit(node.content);
			}
		}
	});

	if (insideNodes.length) {
		const first = insideNodes.sort((a, b) => a.loc.start.offset - b.loc.start.offset)[0];
		const last = insideNodes.sort((a, b) => b.loc.end.offset - a.loc.end.offset)[0];
		return [first.loc.start.offset, last.loc.end.offset];
	}
}

function constructTag(name: string, attributes: string[], initialIndent: boolean, content: string) {
	if (initialIndent) content = content.split('\n').map(line => `\t${line}`).join('\n');
	const attributesString = attributes.length ? ` ${attributes.join(' ')}` : '';
	return `<${name}${attributesString}>\n${content}\n</${name}>\n`;
}

export function getLastImportNode(ts: typeof import('typescript/lib/tsserverlibrary'), sourceFile: ts.SourceFile) {

	let lastImportNode: ts.Node | undefined;

	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			lastImportNode = statement;
		}
		else {
			break;
		}
	}

	return lastImportNode;
}

export function createAddComponentToOptionEdit(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile, componentName: string) {

	const exportDefault = scriptRanges.parseScriptRanges(ts, ast, false, true).exportDefault;
	if (!exportDefault)
		return;

	// https://github.com/microsoft/TypeScript/issues/36174
	const printer = ts.createPrinter();
	if (exportDefault.componentsOption && exportDefault.componentsOptionNode) {
		const newNode: typeof exportDefault.componentsOptionNode = {
			...exportDefault.componentsOptionNode,
			properties: [
				...exportDefault.componentsOptionNode.properties,
				ts.factory.createShorthandPropertyAssignment(componentName),
			] as any as ts.NodeArray<ts.ObjectLiteralElementLike>,
		};
		const printText = printer.printNode(ts.EmitHint.Expression, newNode, ast);
		return {
			range: exportDefault.componentsOption,
			newText: unescape(printText.replace(unicodeReg, '%u')),
		};
	}
	else if (exportDefault.args && exportDefault.argsNode) {
		const newNode: typeof exportDefault.argsNode = {
			...exportDefault.argsNode,
			properties: [
				...exportDefault.argsNode.properties,
				ts.factory.createShorthandPropertyAssignment(`components: { ${componentName} }`),
			] as any as ts.NodeArray<ts.ObjectLiteralElementLike>,
		};
		const printText = printer.printNode(ts.EmitHint.Expression, newNode, ast);
		return {
			range: exportDefault.args,
			newText: unescape(printText.replace(unicodeReg, '%u')),
		};
	}
}
