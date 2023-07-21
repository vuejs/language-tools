import { CreateFile, Service, ServiceContext, TextDocumentEdit, TextEdit } from '@volar/language-service';
import type { ElementNode, RootNode } from '@vue/compiler-dom';
import { SfcBlock, VueFile, walkElementNodes } from '@vue/language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { Provide } from 'volar-service-typescript';

interface ActionData {
	uri: string;
	range: [number, number];
	newName: string;
}

export default function (): Service {

	return (ctx: ServiceContext<Provide> | undefined, modules): ReturnType<Service> => {

		if (!modules?.typescript)
			return {};

		const ts = modules.typescript;

		return {

			async provideCodeActions(document, range, _context) {

				const startOffset = document.offsetAt(range.start);
				const endOffset = document.offsetAt(range.end);
				if (startOffset === endOffset) {
					return;
				}

				const [vueFile] = ctx!.documents.getVirtualFileByUri(document.uri);
				if (!vueFile || !(vueFile instanceof VueFile))
					return;

				const { sfc } = vueFile;
				const script = sfc.scriptSetup ?? sfc.script;
				const scriptAst = sfc.scriptSetupAst ?? sfc.scriptAst;

				if (!sfc.template || !sfc.templateAst || !script || !scriptAst)
					return;

				const templateCodeRange = selectTemplateCode(startOffset, endOffset, sfc.template, sfc.templateAst);
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
				const document = ctx!.getTextDocument(uri)!;
				const [startOffset, endOffset]: [number, number] = range;
				const [vueFile] = ctx!.documents.getVirtualFileByUri(document.uri) as [VueFile, any];
				const { sfc } = vueFile;
				const script = sfc.scriptSetup ?? sfc.script;
				const scriptAst = sfc.scriptSetupAst ?? sfc.scriptAst;

				if (!sfc.template || !sfc.templateAst || !script || !scriptAst)
					return codeAction;

				const templateCodeRange = selectTemplateCode(startOffset, endOffset, sfc.template, sfc.templateAst);
				if (!templateCodeRange)
					return codeAction;

				const languageService = ctx!.inject('typescript/languageService');
				const languageServiceHost = ctx!.inject('typescript/languageServiceHost');
				const sourceFile = languageService.getProgram()!.getSourceFile(vueFile.mainScriptName)!;
				const sourceFileKind = languageServiceHost.getScriptKind?.(vueFile.mainScriptName);
				const toExtract = collectExtractProps();
				const initialIndentSetting = await ctx!.env.getConfiguration!('volar.format.initialIndent') as Record<string, boolean>;
				const newUri = document.uri.substring(0, document.uri.lastIndexOf('/') + 1) + `${newName}.vue`;
				const lastImportNode = getLastImportNode(scriptAst);

				let newFileTags = [];

				newFileTags.push(
					constructTag('template', [], initialIndentSetting.html, sfc.template.content.substring(templateCodeRange[0], templateCodeRange[1]))
				);

				if (toExtract.length) {
					newFileTags.push(
						constructTag('script', ['setup', 'lang="ts"'], isInitialIndentNeeded(ts, sourceFileKind!, initialIndentSetting), generateNewScriptContents())
					);
				}
				if (sfc.template.startTagEnd > script.startTagEnd) {
					newFileTags = newFileTags.reverse();
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
								edits: [
									{
										range: {
											start: document.positionAt(sfc.template.startTagEnd + templateCodeRange[0]),
											end: document.positionAt(sfc.template.startTagEnd + templateCodeRange[1]),
										},
										newText: generateReplaceTemplate(),
									} satisfies TextEdit,
									{
										range: lastImportNode ? {
											start: document.positionAt(script.startTagEnd + lastImportNode.end),
											end: document.positionAt(script.startTagEnd + lastImportNode.end),
										} : {
											start: document.positionAt(script.startTagEnd),
											end: document.positionAt(script.startTagEnd),
										},
										newText: `\nimport ${newName} from './${newName}.vue'`,
									} satisfies TextEdit,
								],
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

				function getLastImportNode(sourceFile: ts.SourceFile) {

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

				function collectExtractProps() {

					const result = new Map<string, {
						name: string;
						type: string;
						model: boolean;
					}>();
					const checker = languageService.getProgram()!.getTypeChecker();
					const maps = [...ctx!.documents.getMapsByVirtualFileName(vueFile.mainScriptName)];

					sourceFile.forEachChild(function visit(node) {
						if (
							ts.isPropertyAccessExpression(node)
							&& ts.isIdentifier(node.expression)
							&& node.expression.text === '__VLS_ctx'
							&& ts.isIdentifier(node.name)
						) {
							const { name } = node;
							for (const [_, map] of maps) {
								const source = map.map.toSourceOffset(name.getEnd());
								if (source && source[0] >= sfc.template!.startTagEnd + templateCodeRange![0] && source[0] <= sfc.template!.startTagEnd + templateCodeRange![1] && source[1].data.semanticTokens) {
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
	};
}

function selectTemplateCode(startOffset: number, endOffset: number, templateBlock: SfcBlock, templateAst: RootNode) {

	if (startOffset < templateBlock.startTagEnd || endOffset > templateBlock.endTagStart)
		return;

	const insideNodes: ElementNode[] = [];

	walkElementNodes(templateAst, (node) => {
		if (
			node.loc.start.offset + templateBlock.startTagEnd >= startOffset
			&& node.loc.end.offset + templateBlock.startTagEnd <= endOffset
		) {
			insideNodes.push(node);
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

function isInitialIndentNeeded(ts: typeof import("typescript/lib/tsserverlibrary"), languageKind: ts.ScriptKind, initialIndentSetting: Record<string, boolean>) {
	const languageKindIdMap = {
		[ts.ScriptKind.JS]: 'javascript',
		[ts.ScriptKind.TS]: 'typescript',
		[ts.ScriptKind.JSX]: 'javascriptreact',
		[ts.ScriptKind.TSX]: 'typescriptreact',
	} as Record<ts.ScriptKind, string>;
	return initialIndentSetting[languageKindIdMap[languageKind]] ?? false;
}
