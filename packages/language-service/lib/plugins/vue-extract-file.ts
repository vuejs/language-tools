import type { CreateFile, LanguageServiceContext, LanguageServicePlugin, TextDocumentEdit, TextEdit } from '@volar/language-service';
import type { ExpressionNode, TemplateChildNode } from '@vue/compiler-dom';
import { Sfc, VueVirtualCode, scriptRanges } from '@vue/language-core';
import type * as ts from 'typescript';
import type * as vscode from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';

interface ActionData {
	uri: string;
	range: [number, number];
	newName: string;
}

const unicodeReg = /\\u/g;

export function create(
	ts: typeof import('typescript'),
	getTsPluginClient?: (context: LanguageServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined
): LanguageServicePlugin {
	return {
		name: 'vue-extract-file',
		capabilities: {
			codeActionProvider: {
				resolveProvider: true,
			},
		},
		create(context) {
			const tsPluginClient = getTsPluginClient?.(context);
			return {
				provideCodeActions(document, range, _context) {

					const startOffset = document.offsetAt(range.start);
					const endOffset = document.offsetAt(range.end);
					if (startOffset === endOffset) {
						return;
					}

					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!(sourceScript?.generated?.root instanceof VueVirtualCode) || virtualCode?.id !== 'template') {
						return;
					}

					const { sfc } = sourceScript.generated.root;
					const script = sfc.scriptSetup ?? sfc.script;

					if (!sfc.template || !script) {
						return;
					}

					const templateCodeRange = selectTemplateCode(startOffset, endOffset, sfc.template);
					if (!templateCodeRange) {
						return;
					}

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
					const parsedUri = URI.parse(uri);
					const decoded = context.decodeEmbeddedDocumentUri(parsedUri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!(sourceScript?.generated?.root instanceof VueVirtualCode) || virtualCode?.id !== 'template') {
						return codeAction;
					}

					const document = context.documents.get(parsedUri, virtualCode.languageId, virtualCode.snapshot);
					const sfcDocument = context.documents.get(sourceScript.id, sourceScript.languageId, sourceScript.snapshot);
					const { sfc } = sourceScript.generated.root;
					const script = sfc.scriptSetup ?? sfc.script;

					if (!sfc.template || !script) {
						return codeAction;
					}

					const templateCodeRange = selectTemplateCode(startOffset, endOffset, sfc.template);
					if (!templateCodeRange) {
						return codeAction;
					}

					const toExtract = await tsPluginClient?.collectExtractProps(sourceScript.generated.root.fileName, templateCodeRange) ?? [];
					if (!toExtract) {
						return codeAction;
					}

					const templateInitialIndent = await context.env.getConfiguration!<boolean>('vue.format.template.initialIndent') ?? true;
					const scriptInitialIndent = await context.env.getConfiguration!<boolean>('vue.format.script.initialIndent') ?? false;
					const newUri = sfcDocument.uri.substring(0, sfcDocument.uri.lastIndexOf('/') + 1) + `${newName}.vue`;
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

					const templateEdits: vscode.TextEdit[] = [
						{
							range: {
								start: document.positionAt(templateCodeRange[0]),
								end: document.positionAt(templateCodeRange[1]),
							},
							newText: generateReplaceTemplate(),
						},
					];

					const sfcEdits: vscode.TextEdit[] = [
						{
							range: lastImportNode ? {
								start: sfcDocument.positionAt(script.startTagEnd + lastImportNode.end),
								end: sfcDocument.positionAt(script.startTagEnd + lastImportNode.end),
							} : {
								start: sfcDocument.positionAt(script.startTagEnd),
								end: sfcDocument.positionAt(script.startTagEnd),
							},
							newText: `\nimport ${newName} from './${newName}.vue'`,
						},
					];

					if (sfc.script) {
						const edit = createAddComponentToOptionEdit(ts, sfc.script.ast, newName);
						if (edit) {
							sfcEdits.push({
								range: {
									start: sfcDocument.positionAt(sfc.script.startTagEnd + edit.range.start),
									end: sfcDocument.positionAt(sfc.script.startTagEnd + edit.range.end),
								},
								newText: edit.newText,
							});
						}
					}

					return {
						...codeAction,
						edit: {
							documentChanges: [
								// editing template virtual document
								{
									textDocument: {
										uri: document.uri,
										version: null,
									},
									edits: templateEdits,
								} satisfies TextDocumentEdit,

								// editing vue sfc
								{
									textDocument: {
										uri: sourceScript.id.toString(),
										version: null,
									},
									edits: sfcEdits,
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

					function generateNewScriptContents() {
						const lines = [];
						const props = toExtract.filter(p => !p.model);
						const models = toExtract.filter(p => p.model);
						if (props.length) {
							lines.push(`defineProps<{ \n\t${props.map(p => `${p.name}: ${p.type};`).join('\n\t')}\n}>()`);
						}
						for (const model of models) {
							lines.push(`const ${model.name} = defineModel<${model.type}>('${model.name}', { required: true })`);
						}
						return lines.join('\n');
					}

					function generateReplaceTemplate() {
						const props = toExtract.filter(p => !p.model);
						const models = toExtract.filter(p => p.model);
						return [
							`<${newName}`,
							...props.map(p => `:${p.name}="${p.name}"`),
							...models.map(p => `v-model:${p.name}="${p.name}"`),
							`/>`,
						].join(' ');
					}
				},
			};
		},
	};
}

function selectTemplateCode(startOffset: number, endOffset: number, templateBlock: NonNullable<Sfc['template']>): [number, number] | undefined {

	const insideNodes: (TemplateChildNode | ExpressionNode)[] = [];

	templateBlock.ast?.children.forEach(function visit(node: TemplateChildNode | ExpressionNode) {
		if (
			node.loc.start.offset >= startOffset
			&& node.loc.end.offset <= endOffset
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
	if (initialIndent) {
		content = content.split('\n').map(line => `\t${line}`).join('\n');
	}
	const attributesString = attributes.length ? ` ${attributes.join(' ')}` : '';
	return `<${name}${attributesString}>\n${content}\n</${name}>\n`;
}

export function getLastImportNode(ts: typeof import('typescript'), sourceFile: ts.SourceFile) {

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

export function createAddComponentToOptionEdit(ts: typeof import('typescript'), ast: ts.SourceFile, componentName: string) {

	const exportDefault = scriptRanges.parseScriptRanges(ts, ast, false, true).exportDefault;
	if (!exportDefault) {
		return;
	}

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
