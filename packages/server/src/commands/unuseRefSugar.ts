import * as shared from '@volar/shared';
import type { Connection } from 'vscode-languageserver';
import * as vscode from 'vscode-languageserver-protocol';
import * as vue from 'vscode-vue-languageservice';

export async function execute(
	vueLs: vue.LanguageService,
	connection: Connection,
	uri: string,
) {

	const sourceFile = vueLs.__internal__.context.vueDocuments.get(uri);
	if (!sourceFile) return;

	const descriptor = sourceFile.getDescriptor();
	if (!descriptor.scriptSetup) return;

	const scriptSetupAst = sourceFile.getScriptSetupAst();
	if (!scriptSetupAst) return;

	const progress = await connection.window.createWorkDoneProgress();
	progress.begin('Unuse Ref Sugar', 0, '', true);

	const edits = await getUnRefSugarEdits(sourceFile, descriptor.scriptSetup, scriptSetupAst);

	if (progress.token.isCancellationRequested)
		return;

	if (edits?.length) {

		await connection.workspace.applyEdit({ changes: { [uri]: edits } });
		await shared.sleep(200);

		const errors = await vueLs.doValidation(uri, () => { }) ?? [];
		const importEdits = await getAddMissingImportsEdits(sourceFile, descriptor.scriptSetup);
		const removeInvalidValueEdits = getRemoveInvalidDotValueEdits(sourceFile, errors);

		if (importEdits && removeInvalidValueEdits) {
			vue.margeWorkspaceEdits(importEdits, removeInvalidValueEdits);
			await connection.workspace.applyEdit(importEdits);
		}
		else if (importEdits || removeInvalidValueEdits) {
			await connection.workspace.applyEdit((importEdits ?? removeInvalidValueEdits)!);
		}
	}

	progress.done();

	async function getAddMissingImportsEdits(
		_sourceFile: NonNullable<typeof sourceFile>,
		_scriptSetup: NonNullable<typeof descriptor['scriptSetup']>,
	) {

		const document = _sourceFile.getTextDocument();
		const codeActions = await vueLs.getCodeActions(uri, {
			start: document.positionAt(_scriptSetup.startTagEnd),
			end: document.positionAt(_scriptSetup.startTagEnd),
		}, {
			diagnostics: [],
			only: [`${vscode.CodeActionKind.Source}.addMissingImports.ts`],
		});

		for (const codeAction of codeActions) {
			const newCodeAction = await vueLs.doCodeActionResolve(codeAction);
			if (newCodeAction.edit) {
				return newCodeAction.edit;
			}
		}
	}
	function getRemoveInvalidDotValueEdits(
		_sourceFile: NonNullable<typeof sourceFile>,
		errors: vscode.Diagnostic[],
	) {

		const document = _sourceFile.getTextDocument();
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

		const result: vscode.WorkspaceEdit = { documentChanges: [vscode.TextDocumentEdit.create(vscode.OptionalVersionedTextDocumentIdentifier.create(uri, document.version), edits)] };
		return result;
	}
	async function getUnRefSugarEdits(
		_sourceFile: NonNullable<typeof sourceFile>,
		_scriptSetup: NonNullable<typeof descriptor['scriptSetup']>,
		_scriptSetupAst: NonNullable<typeof scriptSetupAst>,
	) {

		const ranges = _sourceFile.getSfcRefSugarRanges();
		const document = _sourceFile.getTextDocument();
		const edits: vscode.TextEdit[] = [];

		if (!ranges)
			return;

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

				if (progress?.token.isCancellationRequested)
					return;

				const varText = _scriptSetup.content.substring(binding.start, binding.end);
				progress?.report(++varsCur / varsNum * 100, varText);
				await shared.sleep(0);

				const bindingName = _scriptSetup.content.substring(binding.start, binding.end);
				const renames = await vueLs.doRename(uri, document.positionAt(_scriptSetup.startTagEnd + binding.end), bindingName + '.value');

				if (renames?.changes) {
					const edits_2 = renames.changes[uri];
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
			if (ranges) {
				for (const rawRange of ranges.raws) {
					if (start >= (_scriptSetup.startTagEnd + rawRange.argsRange.start) && end <= (_scriptSetup.startTagEnd + rawRange.argsRange.end)) {
						return true;
					}
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
