import type { CreateFile, LanguageServicePlugin, TextDocumentEdit, TextEdit } from '@volar/language-service';
import type { ExpressionNode, TemplateChildNode } from '@vue/compiler-dom';
import type { IRTemplate, ts, TypeScript } from '@vue/language-core';
import { URI } from 'vscode-uri';
import { embeddedCodeIds, type VueVirtualCode } from '../virtualCode';
import { resolveEmbeddedCode } from '../virtualCodeQueries';

interface ActionData {
	uri: string;
	range: [number, number];
	newName: string;
}

export function create(
	{ collectExtractProps }: import('../requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-extract-file',
		capabilities: {
			codeActionProvider: {
				codeActionKinds: ['refactor'],
				resolveProvider: true,
			},
		},
		create(context) {
			return {
				provideCodeActions(document, range, ctx) {
					if (ctx.only && !ctx.only.includes('refactor')) {
						return;
					}

					const startOffset = document.offsetAt(range.start);
					const endOffset = document.offsetAt(range.end);
					if (startOffset === endOffset) {
						return;
					}

					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== embeddedCodeIds.template) {
						return;
					}

					const { ir } = info.root;
					const script = ir.scriptSetup ?? ir.script;
					if (!ir.template || !script) {
						return;
					}

					const templateCodeRange = selectTemplateCode(startOffset, endOffset, ir.template);
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

					const info = resolveEmbeddedCode(context, uri);
					if (info?.code.id !== embeddedCodeIds.template) {
						return codeAction;
					}

					const { ir } = info.root;
					const script = ir.scriptSetup ?? ir.script;
					if (!ir.template || !script) {
						return codeAction;
					}

					const templateCodeRange = selectTemplateCode(startOffset, endOffset, ir.template);
					if (!templateCodeRange) {
						return codeAction;
					}

					const toExtract = await collectExtractProps(info.root.fileName, templateCodeRange) ?? [];

					const templateInitialIndent =
						await context.env.getConfiguration!<boolean>('vue.format.template.initialIndent') ?? true;
					const scriptInitialIndent = await context.env.getConfiguration!<boolean>('vue.format.script.initialIndent')
						?? false;

					const document = context.documents.get(URI.parse(uri), info.code.languageId, info.code.snapshot);
					const sfcDocument = context.documents.get(info.script.id, info.script.languageId, info.script.snapshot);
					const newUri = sfcDocument.uri.slice(0, sfcDocument.uri.lastIndexOf('/') + 1) + `${newName}.vue`;
					const lastImportNode = getLastImportNode(info.root.ts, script.ast);

					let newFileTags = [];

					newFileTags.push(
						constructTag(
							'template',
							[],
							templateInitialIndent,
							ir.template.content.slice(templateCodeRange[0], templateCodeRange[1]),
						),
					);

					if (toExtract.length) {
						newFileTags.push(
							constructTag('script', ['setup', 'lang="ts"'], scriptInitialIndent, generateNewScriptContents()),
						);
					}
					if (ir.template.startTagEnd > script.startTagEnd) {
						newFileTags = newFileTags.reverse();
					}

					const templateEdits: TextEdit[] = [
						{
							range: {
								start: document.positionAt(templateCodeRange[0]),
								end: document.positionAt(templateCodeRange[1]),
							},
							newText: generateReplaceTemplate(),
						},
					];

					const sfcEdits: TextEdit[] = [
						{
							range: lastImportNode
								? {
									start: sfcDocument.positionAt(script.startTagEnd + lastImportNode.end),
									end: sfcDocument.positionAt(script.startTagEnd + lastImportNode.end),
								}
								: {
									start: sfcDocument.positionAt(script.startTagEnd),
									end: sfcDocument.positionAt(script.startTagEnd),
								},
							newText: `\nimport ${newName} from './${newName}.vue'`,
						},
					];

					if (ir.script) {
						const edit = createAddComponentToOptionEdit(info.root, ir.script.ast, newName);
						if (edit) {
							sfcEdits.push({
								range: {
									start: sfcDocument.positionAt(ir.script.startTagEnd + edit.range.start),
									end: sfcDocument.positionAt(ir.script.startTagEnd + edit.range.end),
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
										uri: info.script.id.toString(),
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
							lines.push(`defineProps<{\n\t${props.map(p => `${p.name}: ${p.type};`).join('\n\t')}\n}>()`);
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

function selectTemplateCode(
	startOffset: number,
	endOffset: number,
	templateBlock: IRTemplate,
): [number, number] | undefined {
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
		const first = insideNodes.sort((a, b) => a.loc.start.offset - b.loc.start.offset)[0]!;
		const last = insideNodes.sort((a, b) => b.loc.end.offset - a.loc.end.offset)[0]!;
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

export function getLastImportNode(ts: TypeScript, sourceFile: ts.SourceFile) {
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

export function createAddComponentToOptionEdit(root: VueVirtualCode, ast: ts.SourceFile, componentName: string) {
	const componentOptions = root.scriptAnalysis.getScriptRanges()?.exportDefault?.options;
	if (!componentOptions) {
		return;
	}
	if (componentOptions.components) {
		return addObjectProperty(ast, componentOptions.components.node, componentName);
	}
	return addObjectProperty(ast, componentOptions.args.node, `components: { ${componentName} }`);
}

/** Inserts a property after the last one of an object literal, on its own line if that property is. */
function addObjectProperty(ast: ts.SourceFile, node: ts.ObjectLiteralExpression, property: string) {
	const last = node.properties.at(-1);
	if (!last) {
		const pos = node.end - 1;
		return { range: { start: pos, end: pos }, newText: ` ${property} ` };
	}
	const start = last.getStart(ast);
	const lineBreak = ast.text.lastIndexOf('\n', start - 1);
	const indent = ast.text.slice(lineBreak + 1, start);
	return {
		range: { start: last.end, end: last.end },
		newText: lineBreak > node.getStart(ast) && !indent.trim()
			? `,\n${indent}${property}`
			: `, ${property}`,
	};
}
