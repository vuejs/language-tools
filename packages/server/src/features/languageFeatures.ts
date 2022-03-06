import * as shared from '@volar/shared';
import * as vue from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { Projects } from '../projects';
import { fileRenamings, renameFileContentCache, getScriptText } from '../project';
import type { createLsConfigs } from '../configs';
import type { Configuration } from 'vscode-languageserver/lib/common/configuration';
import { getDocumentSafely } from '../utils';
import { Commands } from '../commands';
import * as convertTagNameCase from '../commands/convertTagNameCase';
import * as htmlToPug from '../commands/htmlToPug';
import * as pugToHtml from '../commands/pugToHtml';
import * as useSetupSugar from '../commands/useSetupSugar';
import * as unuseSetupSugar from '../commands/unuseSetupSugar';
import * as useRefSugar from '../commands/useRefSugar';
import * as unuseRefSugar from '../commands/unuseRefSugar';

export function register(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	connection: vscode.Connection,
	configuration: Configuration | undefined,
	documents: vscode.TextDocuments<TextDocument>,
	getProjects: () => Projects | undefined,
	features: NonNullable<shared.ServerInitializationOptions['languageFeatures']>,
	lsConfigs: ReturnType<typeof createLsConfigs> | undefined,
	params: vscode.InitializeParams,
) {
	connection.onCompletion(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		const list = await languageService?.doComplete(
			handler.textDocument.uri,
			handler.position,
			handler.context,
		);
		const insertReplaceSupport = params.capabilities.textDocument?.completion?.completionItem?.insertReplaceSupport ?? false;
		if (!insertReplaceSupport && list) {
			for (const item of list.items) {
				if (item.textEdit && vscode.InsertReplaceEdit.is(item.textEdit)) {
					item.textEdit = vscode.TextEdit.replace(item.textEdit.insert, item.textEdit.newText);
				}
			}
		}
		return list;
	});
	connection.onCompletionResolve(async item => {
		const uri = (item.data as { uri?: string } | undefined)?.uri;
		if (!uri) return item;
		const activeSel = features.completion?.getDocumentSelectionRequest
			? await connection.sendRequest(shared.GetEditorSelectionRequest.type)
			: undefined;
		const newPosition = activeSel?.textDocument.uri.toLowerCase() === uri.toLowerCase() ? activeSel.position : undefined;
		const languageService = await getLanguageService(uri);
		return languageService?.doCompletionResolve(item, newPosition) ?? item;
	});
	connection.onHover(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.doHover(handler.textDocument.uri, handler.position);
	});
	connection.onSignatureHelp(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.getSignatureHelp(handler.textDocument.uri, handler.position, handler.context);
	});
	connection.onPrepareRename(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.prepareRename(handler.textDocument.uri, handler.position);
	});
	connection.onRenameRequest(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.doRename(handler.textDocument.uri, handler.position, handler.newName);
	});
	connection.onCodeLens(async handler => {

		const languageService = await getLanguageService(handler.textDocument.uri);
		if (!languageService) return;

		const sourceFile = languageService.__internal__.context.sourceFiles.get(handler.textDocument.uri);
		if (!sourceFile) return;

		const options = await lsConfigs?.getCodeLensConfigs();
		const document = sourceFile.getTextDocument();

		let result: vscode.CodeLens[] = [];

		if (options?.references) {
			const referencesCodeLens = await languageService.getReferencesCodeLens(handler.textDocument.uri);
			result = result.concat(referencesCodeLens);
		}
		if (options?.pugTool) {
			result = result.concat(getHtmlPugResult(sourceFile));
		}
		if (options?.scriptSetupTool) {
			result = result.concat(getScriptSetupConvertConvert(sourceFile));
			result = result.concat(getRefSugarConvert(sourceFile));
		}

		return result;

		function getScriptSetupConvertConvert(sourceFile: vue.SourceFile) {

			const ranges = sourceFile.getSfcRefSugarRanges();
			if (ranges?.refs.length)
				return [];

			const result: vscode.CodeLens[] = [];
			const descriptor = sourceFile.getDescriptor();
			if (descriptor.scriptSetup) {
				result.push({
					range: {
						start: document.positionAt(descriptor.scriptSetup.startTagEnd),
						end: document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
					},
					command: {
						title: 'setup sugar ☑',
						command: Commands.UNUSE_SETUP_SUGAR,
						arguments: [handler.textDocument.uri],
					},
				});
			}
			else if (descriptor.script) {
				result.push({
					range: {
						start: document.positionAt(descriptor.script.startTagEnd),
						end: document.positionAt(descriptor.script.startTagEnd + descriptor.script.content.length),
					},
					command: {
						title: 'setup sugar ☐',
						command: Commands.USE_SETUP_SUGAR,
						arguments: [handler.textDocument.uri],
					},
				});
			}
			return result;
		}
		function getRefSugarConvert(sourceFile: vue.SourceFile) {
			const result: vscode.CodeLens[] = [];
			const descriptor = sourceFile.getDescriptor();
			const ranges = sourceFile.getSfcRefSugarRanges();
			if (descriptor.scriptSetup && ranges) {
				result.push({
					range: {
						start: document.positionAt(descriptor.scriptSetup.startTagEnd),
						end: document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
					},
					command: {
						title: 'ref sugar (take 2) ' + (ranges.refs.length ? '☑' : '☐'),
						command: ranges.refs.length ? Commands.UNUSE_REF_SUGAR : Commands.USE_REF_SUGAR,
						arguments: [handler.textDocument.uri],
					},
				});
			}
			return result;
		}
		function getHtmlPugResult(sourceFile: vue.SourceFile) {
			const sourceMaps = sourceFile.getTemplateSourceMaps();
			for (const sourceMap of sourceMaps) {
				for (const maped of sourceMap.mappings) {
					if (sourceMap.mappedDocument.languageId === 'html' || sourceMap.mappedDocument.languageId === 'jade') {
						return [{
							range: {
								start: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
								end: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
							},
							command: {
								title: 'pug ' + (sourceMap.mappedDocument.languageId === 'jade' ? '☑' : '☐'),
								command: sourceMap.mappedDocument.languageId === 'jade' ? Commands.PUG_TO_HTML : Commands.HTML_TO_PUG,
								arguments: [handler.textDocument.uri],
							},
						}];
					}
				}
			}
			return [];
		}
	});
	connection.onCodeLensResolve(async codeLens => {
		const uri = (codeLens.data as any)?.uri as string | undefined; // TODO
		if (!uri) return codeLens;
		const languageService = await getLanguageService(uri);
		return languageService?.doReferencesCodeLensResolve(codeLens, Commands.SHOW_REFERENCES) ?? codeLens;
	});
	connection.onExecuteCommand(async handler => {

		if (handler.command === Commands.SHOW_REFERENCES && handler.arguments) {
			connection.sendNotification(shared.ShowReferencesNotification.type, {
				textDocument: { uri: handler.arguments[0] as string },
				position: handler.arguments[1] as vscode.Position,
				references: handler.arguments[2] as vscode.Location[],
			});
			return;
		}

		const uri = handler.arguments?.[0] as string | undefined;
		if (!uri) return;

		const vueLs = await getLanguageService(uri);
		if (!vueLs) return;

		if (handler.command === Commands.USE_SETUP_SUGAR) {
			await useSetupSugar.execute(vueLs, connection, uri);
		}
		if (handler.command === Commands.UNUSE_SETUP_SUGAR) {
			await unuseSetupSugar.execute(vueLs, connection, uri);
		}
		if (handler.command === Commands.USE_REF_SUGAR) {
			await useRefSugar.execute(vueLs, connection, uri);
		}
		if (handler.command === Commands.UNUSE_REF_SUGAR) {
			await unuseRefSugar.execute(vueLs, connection, uri);
		}
		if (handler.command === Commands.HTML_TO_PUG) {
			await htmlToPug.execute(vueLs, connection, uri);
		}
		if (handler.command === Commands.PUG_TO_HTML) {
			await pugToHtml.execute(vueLs, connection, uri);
		}
		if (handler.command === Commands.CONVERT_TO_KEBAB_CASE) {
			await convertTagNameCase.execute(vueLs, connection, uri, 'kebab');
		}
		if (handler.command === Commands.CONVERT_TO_PASCAL_CASE) {
			await convertTagNameCase.execute(vueLs, connection, uri, 'pascal');
		}
	});
	connection.onCodeAction(async handler => {
		const uri = handler.textDocument.uri;
		const languageService = await getLanguageService(uri);
		if (languageService) {
			const codeActions = await languageService.getCodeActions(uri, handler.range, handler.context);
			for (const codeAction of codeActions) {
				if (codeAction.data && typeof codeAction.data === 'object') {
					(codeAction.data as any).uri = uri;
				}
				else {
					codeAction.data = { uri };
				}
			}
			return codeActions;
		}
	});
	connection.onCodeActionResolve(async codeAction => {
		const uri: string | undefined = (codeAction.data as any)?.uri;
		if (uri) {
			const languageService = await getLanguageService(uri);
			if (languageService) {
				return languageService.doCodeActionResolve(codeAction);
			}
		}
		return codeAction;
	});
	connection.onReferences(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findReferences(handler.textDocument.uri, handler.position);
	});
	connection.onDefinition(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findDefinition(handler.textDocument.uri, handler.position);
	});
	connection.onTypeDefinition(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findTypeDefinition(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentHighlight(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findDocumentHighlights(handler.textDocument.uri, handler.position);
	});
	connection.onDocumentLinks(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.findDocumentLinks(handler.textDocument.uri);
	});
	connection.onWorkspaceSymbol(async (handler, token) => {
		const projects = getProjects();
		if (projects) {

			let results: vscode.SymbolInformation[] = [];

			for (const workspace of projects.workspaces.values()) {
				let projects = [...workspace.projects.values()];
				projects = projects.length ? projects : [workspace.getInferredProject()];
				for (const project of projects) {

					if (token.isCancellationRequested)
						return;

					const languageService = await (await project).getLanguageService();

					results = results.concat(await languageService.findWorkspaceSymbols(handler.query));
				}
			}

			return results;
		}
	});
	connection.languages.callHierarchy.onPrepare(async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		const items = await languageService?.callHierarchy.doPrepare(handler.textDocument.uri, handler.position);
		if (items) {
			for (const item of items) {
				if (typeof item.data !== 'object') item.data = {};
				(item.data as any).__uri = handler.textDocument.uri;
			}
		}
		return items?.length ? items : null;
	});
	connection.languages.callHierarchy.onIncomingCalls(async handler => {
		const data = handler.item.data as { __uri?: string } | undefined;
		const uri = data?.__uri ?? handler.item.uri;
		const languageService = await getLanguageService(uri);
		return languageService?.callHierarchy.getIncomingCalls(handler.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(async handler => {
		const data = handler.item.data as { __uri?: string } | undefined;
		const uri = data?.__uri ?? handler.item.uri;
		const languageService = await getLanguageService(uri);
		return languageService?.callHierarchy.getOutgoingCalls(handler.item) ?? [];
	});
	connection.languages.semanticTokens.on(async (handler, token, _, resultProgress) => {
		return onSemanticTokens(handler, token, resultProgress);
	});
	connection.languages.semanticTokens.onRange(async (handler, token, _, resultProgress) => {
		return onSemanticTokens(handler, token, resultProgress);
	});
	connection.workspace.onWillRenameFiles(async handler => {

		const hasTsFile = handler.files.some(file => file.newUri.endsWith('.vue') || file.newUri.endsWith('.ts') || file.newUri.endsWith('.tsx'));
		const config: 'prompt' | 'always' | 'never' | null | undefined = await connection.workspace.getConfiguration(hasTsFile ? 'typescript.updateImportsOnFileMove.enabled' : 'javascript.updateImportsOnFileMove.enabled');

		if (config === 'always') {
			const renaming = new Promise<void>(async resolve => {
				for (const file of handler.files) {
					const renameFileContent = getScriptText(documents, shared.uriToFsPath(file.oldUri), ts.sys);
					if (renameFileContent) {
						renameFileContentCache.set(file.oldUri, renameFileContent);
					}
				}
				await shared.sleep(0);
				const edit = await worker();
				if (edit) {
					if (edit.documentChanges) {
						for (const change of edit.documentChanges) {
							if (vscode.TextDocumentEdit.is(change)) {
								for (const file of handler.files) {
									if (change.textDocument.uri === file.oldUri) {
										change.textDocument.uri = file.newUri;
										change.textDocument.version = getDocumentSafely(documents, file.newUri)?.version ?? change.textDocument.version;
									}
								}
							}
						}
					}
					connection.workspace.applyEdit(edit);
				}
				resolve();
			});
			fileRenamings.add(renaming);
			(async () => {
				await renaming;
				fileRenamings.delete(renaming);
				renameFileContentCache.clear();
			})();
		}

		if (config === 'prompt')
			return await worker();

		return null;

		async function worker() {
			const edits = (await Promise.all(handler.files
				.map(async file => {
					const languageService = await getLanguageService(file.oldUri);
					return languageService?.getEditsForFileRename(file.oldUri, file.newUri);
				}))).filter(shared.notEmpty);
			if (edits.length) {
				const result = edits[0];
				vue.margeWorkspaceEdits(result, ...edits.slice(1));
				return result;
			}
			return null;
		}
	});
	connection.onRequest(shared.AutoInsertRequest.type, async handler => {
		const languageService = await getLanguageService(handler.textDocument.uri);
		return languageService?.doAutoInsert(handler.textDocument.uri, handler.position, handler.options);
	});

	async function onSemanticTokens(
		handler: vscode.SemanticTokensParams | vscode.SemanticTokensRangeParams,
		token: vscode.CancellationToken,
		resultProgress?: vscode.ResultProgressReporter<vscode.SemanticTokensPartialResult>,
	) {

		const languageService = await getLanguageService(handler.textDocument.uri);
		const result = await languageService?.getSemanticTokens(
			handler.textDocument.uri,
			'range' in handler ? handler.range : undefined,
			token,
			tokens => resultProgress?.report(buildTokens(tokens)),
		) ?? [];

		return buildTokens(result);

		function buildTokens(tokens: [number, number, number, number, number | undefined][]) {
			const builder = new vscode.SemanticTokensBuilder();
			for (const token of tokens.sort((a, b) => a[0] - b[0] === 0 ? a[1] - b[1] : a[0] - b[0])) {
				builder.push(token[0], token[1], token[2], token[3], token[4] ?? 0);
			}
			return builder.build();
		}
	}
	async function getLanguageService(uri: string) {
		const projects = await getProjects();
		const project = (await projects?.getProject(uri))?.project;
		return project?.getLanguageService();
	}
}
