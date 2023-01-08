import { ExecuteCommandContext, mergeWorkspaceEdits, LanguageServiceRuntimeContext } from '@volar/language-service';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import * as refSugarRanges from '../utils/refSugarRanges';
import { isBlacklistNode } from './vue-autoinsert-dotvalue';
import { getAddMissingImportsEdits } from './vue-convert-scriptsetup';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { VueLanguageServicePlugin } from '../types';

enum Commands {
	USE_REF_SUGAR = 'refSugarConversions.use',
	UNUSE_REF_SUGAR = 'refSugarConversions.unuse',
}

export interface ReferencesCodeLensData {
	uri: string,
	position: vscode.Position,
}

type CommandArgs = [string];

export default function (): VueLanguageServicePlugin {

	return (context, service) => {

		if (!context.typescript)
			return {};

		const _ts = context.typescript;

		return {

			codeLens: {

				on(document) {
					return worker(document.uri, async (vueFile) => {

						if (document.uri.endsWith('.html')) // petite-vue
							return;

						const isEnabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.codeLens.scriptSetupTools') ?? true;

						if (!isEnabled)
							return;

						const result: vscode.CodeLens[] = [];
						const sfc = vueFile.sfc;

						if (sfc.scriptSetup && sfc.scriptSetupAst) {

							const ranges = getRanges(_ts.module, sfc.scriptSetupAst);

							result.push({
								range: {
									start: document.positionAt(sfc.scriptSetup.startTagEnd),
									end: document.positionAt(sfc.scriptSetup.startTagEnd + sfc.scriptSetup.content.length),
								},
								command: {
									title: 'ref sugar ' + (ranges.refs.length ? '☑' : '☐'),
									command: ranges.refs.length ? Commands.UNUSE_REF_SUGAR : Commands.USE_REF_SUGAR,
									arguments: [document.uri],
								},
							});
						}

						return result;
					});
				},
			},

			doExecuteCommand(command, args, commandContext) {

				if (command === Commands.USE_REF_SUGAR) {

					const [uri] = args as CommandArgs;

					return worker(uri, (vueFile) => {
						const document = context.documents.getDocumentByFileName(vueFile.snapshot, vueFile.fileName);
						return useRefSugar(_ts, document, vueFile, commandContext, service.findReferences, service.findTypeDefinition);
					});
				}

				if (command === Commands.UNUSE_REF_SUGAR) {

					const [uri] = args as CommandArgs;

					return worker(uri, (vueFile) => {
						const document = context.documents.getDocumentByFileName(vueFile.snapshot, vueFile.fileName);
						return unuseRefSugar(_ts.module, document, vueFile, commandContext, service.doCodeActions, service.doCodeActionResolve, service.doRename, service.doValidation);
					});
				}
			},
		};

		function worker<T>(uri: string, callback: (vueSourceFile: vue.VueFile) => T) {

			const [virtualFile] = context.documents.getVirtualFileByUri(uri);
			if (!(virtualFile instanceof vue.VueFile))
				return;

			return callback(virtualFile);
		}
	};
}

async function useRefSugar(
	_ts: NonNullable<LanguageServiceRuntimeContext['typescript']>,
	document: TextDocument,
	vueSourceFile: vue.VueFile,
	commandContext: ExecuteCommandContext,
	findReferences: (uri: string, position: vscode.Position) => Promise<vscode.Location[] | undefined>,
	findTypeDefinition: (uri: string, position: vscode.Position) => Promise<vscode.LocationLink[] | undefined>,
) {

	const ts = _ts.module;

	const sfc = vueSourceFile.sfc;
	if (!sfc.scriptSetup) return;
	if (!sfc.scriptSetupAst) return;

	commandContext.workDoneProgress.begin('Use Ref Sugar', 0, '', true);

	const edits = await getUseRefSugarEdits(document, sfc.scriptSetup, sfc.scriptSetupAst);

	if (commandContext.token.isCancellationRequested)
		return;

	if (edits?.length) {
		await commandContext.applyEdit({ changes: { [document.uri]: edits } });
	}

	commandContext.workDoneProgress.done();

	async function getUseRefSugarEdits(
		document: TextDocument,
		_scriptSetup: NonNullable<typeof sfc['scriptSetup']>,
		_scriptSetupAst: ts.SourceFile,
	) {

		const ranges = refSugarRanges.parseDeclarationRanges(ts, _scriptSetupAst);
		const dotValueRanges = refSugarRanges.parseDotValueRanges(ts, _scriptSetupAst);
		const edits: vscode.TextEdit[] = [];

		for (const declaration of ranges) {

			let isRefDeclaration = false;

			for (const binding of declaration.leftBindings) {

				const definitions = await findTypeDefinition(document.uri, document.positionAt(_scriptSetup.startTagEnd + binding.end)) ?? [];
				const _isRefType = isRefType(definitions);

				if (!_isRefType)
					continue;

				isRefDeclaration = true;

				let references = await findReferences(document.uri, document.positionAt(_scriptSetup.startTagEnd + binding.end)) ?? [];

				references = references.filter(reference => {

					if (reference.uri !== document.uri)
						return false;

					const start = document.offsetAt(reference.range.start);
					const end = document.offsetAt(reference.range.end);

					if (start >= (_scriptSetup.startTagEnd + binding.start) && end <= (_scriptSetup.startTagEnd + binding.end))
						return false;

					if (end < _scriptSetup.startTagEnd || start > _scriptSetup.startTagEnd + _scriptSetup.content.length)
						return false;

					if (isBlacklistNode(ts, _scriptSetupAst, start - _scriptSetup.startTagEnd, true))
						return false;

					return true;
				});

				for (const reference of references) {

					const sfcStart = document.offsetAt(reference.range.start);
					const sfcEnd = document.offsetAt(reference.range.end);
					const setupStart = sfcStart - _scriptSetup.startTagEnd;
					const setupEnd = sfcEnd - _scriptSetup.startTagEnd;
					const dotValue = dotValueRanges.find(dot => dot.beforeDot === setupEnd);

					if (!dotValue) {
						addReplace(setupStart, setupStart, '$raw(');
						addReplace(setupEnd, setupEnd, ')');
					}
					else {
						addReplace(dotValue.beforeDot, dotValue.range.end, '');
					}
				}
			}

			if (isRefDeclaration) {
				if (!declaration.leftIsIdentifier) {
					addReplace(declaration.right.start, declaration.right.start, '$fromRefs(');
					addReplace(declaration.right.end, declaration.right.end, ')');
				}
				else if (declaration.rightFn) {
					const fnText = _scriptSetup.content.substring(declaration.rightFn.start, declaration.rightFn.end);
					if (['ref', 'shallowRef'].includes(fnText)) {
						addReplace(declaration.flag.start, declaration.flag.end, 'let');
					}
					if (['ref', 'computed', 'shallowRef'].includes(fnText)) {
						addReplace(declaration.right.start, declaration.right.start, '$');
					}
				}
				else {
					addReplace(declaration.right.start, declaration.right.start, '$ref(');
					addReplace(declaration.right.end, declaration.right.end, ')');
				}
			}
		}

		return edits;

		function addReplace(start: number, end: number, text: string) {

			if (_scriptSetup.content.substring(start, end) === text)
				return;

			edits.push(vscode.TextEdit.replace(
				{
					start: document.positionAt(_scriptSetup.startTagEnd + start),
					end: document.positionAt(_scriptSetup.startTagEnd + end),
				},
				text
			));
		}
	}

	function isRefType(typeDefs: vscode.LocationLink[]) {
		const tsHost = _ts.languageServiceHost;
		for (const typeDefine of typeDefs) {
			const uri = vscode.Location.is(typeDefine) ? typeDefine.uri : typeDefine.targetUri;
			const range = vscode.Location.is(typeDefine) ? typeDefine.range : typeDefine.targetSelectionRange;
			const snapshot = tsHost.getScriptSnapshot(shared.uriToFileName(uri));
			if (!snapshot)
				continue;
			const defineDoc = TextDocument.create(uri, 'typescript', 0, snapshot.getText(0, snapshot.getLength()));
			const typeName = defineDoc.getText(range);
			switch (typeName) {
				case 'Ref':
				case 'ComputedRef':
				case 'WritableComputedRef':
					return true;
			}
		}
		return false;
	}
}

async function unuseRefSugar(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	document: TextDocument,
	vueSourceFile: vue.VueFile,
	context: ExecuteCommandContext,
	doCodeActions: (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => Promise<vscode.CodeAction[] | undefined>,
	doCodeActionResolve: (item: vscode.CodeAction) => Promise<vscode.CodeAction>,
	doRename: (uri: string, position: vscode.Position, newName: string) => Promise<vscode.WorkspaceEdit | undefined>,
	doValidation: (uri: string) => Promise<vscode.Diagnostic[] | undefined>,
) {

	const sfc = vueSourceFile.sfc;
	if (!sfc.scriptSetup) return;
	if (!sfc.scriptSetupAst) return;

	context.workDoneProgress.begin('Unuse Ref Sugar', 0, '', true);

	const edits = await getUnRefSugarEdits(document, sfc.scriptSetup, sfc.scriptSetupAst);

	if (context.token.isCancellationRequested)
		return;

	if (edits?.length) {

		await context.applyEdit({ changes: { [document.uri]: edits } });
		await shared.sleep(200);

		const errors = await doValidation(document.uri) ?? [];
		const importEdits = await getAddMissingImportsEdits(document, doCodeActions, doCodeActionResolve);
		const removeInvalidValueEdits = getRemoveInvalidDotValueEdits(document, errors);

		if (importEdits && removeInvalidValueEdits) {
			mergeWorkspaceEdits(importEdits, removeInvalidValueEdits);
			await context.applyEdit(importEdits);
		}
		else if (importEdits || removeInvalidValueEdits) {
			await context.applyEdit((importEdits ?? removeInvalidValueEdits)!);
		}
	}

	context.workDoneProgress.done();

	function getRemoveInvalidDotValueEdits(
		document: TextDocument,
		errors: vscode.Diagnostic[],
	) {

		const edits: vscode.TextEdit[] = [];

		for (const error of errors) {
			const errorText = document.getText(error.range);
			if (error.code === 2339 && errorText === 'value') {
				edits.push(vscode.TextEdit.del({
					start: {
						line: error.range.start.line,
						character: error.range.start.character - 1,
					},
					end: error.range.end,
				}));
			}
		}

		if (!edits.length)
			return;

		const result: vscode.WorkspaceEdit = { documentChanges: [vscode.TextDocumentEdit.create(vscode.OptionalVersionedTextDocumentIdentifier.create(document.uri, document.version), edits)] };
		return result;
	}
	async function getUnRefSugarEdits(
		document: TextDocument,
		_scriptSetup: NonNullable<typeof sfc['scriptSetup']>,
		_scriptSetupAst: ts.SourceFile,
	) {

		const ranges = getRanges(ts, _scriptSetupAst);
		const edits: vscode.TextEdit[] = [];

		let varsNum = 0;
		let varsCur = 0;

		for (const callRange of ranges.refs) {
			varsNum += callRange.leftBindings.length;
		}

		for (const callRange of ranges.refs) {

			addReplace(callRange.flag.start, callRange.flag.end, 'const');

			const fnName = _scriptSetup.content.substring(callRange.rightFn.start, callRange.rightFn.end);

			if (fnName === '$fromRefs') {

			}
			else {
				const newFnName = fnName.substring(1); // $ref -> ref
				addReplace(callRange.rightFn.start, callRange.rightFn.end, newFnName);
			}


			for (const binding of callRange.leftBindings) {

				if (context.token.isCancellationRequested)
					return;

				const varText = _scriptSetup.content.substring(binding.start, binding.end);
				context.workDoneProgress.report(++varsCur / varsNum * 100, varText);
				await shared.sleep(0);

				const bindingName = _scriptSetup.content.substring(binding.start, binding.end);
				const renames = await doRename(document.uri, document.positionAt(_scriptSetup.startTagEnd + binding.end), bindingName + '.value');

				if (renames?.changes) {
					const edits_2 = renames.changes[document.uri];
					if (edits_2) {
						for (const edit of edits_2) {

							const editRange = {
								start: document.offsetAt(edit.range.start),
								end: document.offsetAt(edit.range.end),
							};

							if (editRange.start >= (_scriptSetup.startTagEnd + binding.start) && editRange.end <= (_scriptSetup.startTagEnd + binding.end))
								continue;

							if (editRange.end < _scriptSetup.startTagEnd || editRange.start > _scriptSetup.startTagEnd + _scriptSetup.content.length)
								continue;

							if (inRawCall(editRange.start, editRange.end))
								continue;

							edits.push(edit);
						}
					}
				}
			}
		}

		for (const rawCall of ranges.raws) {
			addReplace(rawCall.fullRange.start, rawCall.argsRange.start, '');
			addReplace(rawCall.argsRange.end, rawCall.fullRange.end, '');
		}

		return edits;

		function inRawCall(start: number, end: number) {
			for (const rawRange of ranges.raws) {
				if (start >= (_scriptSetup.startTagEnd + rawRange.argsRange.start) && end <= (_scriptSetup.startTagEnd + rawRange.argsRange.end)) {
					return true;
				}
			}
			return false;
		}
		function addReplace(start: number, end: number, text: string) {

			if (_scriptSetup.content.substring(start, end) === text)
				return;

			edits.push(vscode.TextEdit.replace(
				{
					start: document.positionAt(_scriptSetup.startTagEnd + start),
					end: document.positionAt(_scriptSetup.startTagEnd + end),
				},
				text
			));
		}
	}
}

function getRanges(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	scriptSetupAst: ts.SourceFile,
) {
	return {
		refs: refSugarRanges.parseRefSugarDeclarationRanges(ts, scriptSetupAst, ['$ref', '$computed', '$shallowRef', '$fromRefs']),
		raws: refSugarRanges.parseRefSugarCallRanges(ts, scriptSetupAst, ['$raw', '$fromRefs']),
	};
}
