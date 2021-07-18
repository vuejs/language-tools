import * as vscode from 'vscode-languageserver';
import * as shared from '@volar/shared';
import { SearchTexts } from '../utils/string';
import { parseRefSugarRanges } from '../parsers/scriptSetupRanges';
import type { ApiLanguageServiceContext } from '../types';

export async function execute(
	connection: vscode.Connection,
	context: ApiLanguageServiceContext,
	uri: string,
	_findReferences: (uri: string, position: vscode.Position) => vscode.Location[],
) {

	const progress = await connection.window.createWorkDoneProgress();
	progress.begin('Unuse Ref Sugar', 0, '', true);

	const edits = await getUnRefSugarEdits(context, uri, _findReferences, progress);

	if (!progress.token.isCancellationRequested && edits.length) {
		await connection.workspace.applyEdit({ changes: { [uri]: edits } });
	}

	progress.done();
}

export function register(
	context: ApiLanguageServiceContext,
	_findReferences: (uri: string, position: vscode.Position) => vscode.Location[],
) {
	return (
		uri: string,
		progress?: vscode.WorkDoneProgressServerReporter,
	) => getUnRefSugarEdits(context, uri, _findReferences, progress);
}

async function getUnRefSugarEdits(
	{ sourceFiles, ts, scriptTsLs }: ApiLanguageServiceContext,
	uri: string,
	_findReferences: (uri: string, position: vscode.Position) => vscode.Location[],
	progress?: vscode.WorkDoneProgressServerReporter,
) {

	const sourceFile = sourceFiles.get(uri);
	if (!sourceFile) return [];

	const descriptor = sourceFile.getDescriptor();
	if (!descriptor.scriptSetup) return [];

	const genData = sourceFile.getScriptSetupData();
	if (!genData) return [];

	const document = sourceFile.getTextDocument();
	const scriptSetup = descriptor.scriptSetup;
	const genData2 = parseRefSugarRanges(ts, scriptSetup.content, scriptSetup.lang);

	let varsNum = 0;
	let varsCur = 0;
	for (const label of genData.labels) {
		for (const binary of label.binarys) {
			varsNum += binary.vars.length;
		}
	}

	const edits: vscode.TextEdit[] = [];
	let hasNewRefCall = false;

	for (const label of genData.labels) {

		const labelReplace = scriptSetup.content.substring(label.label.end + 1, label.label.end + 2).trim() === ''
			? 'const' // ref: xxx -> const xxx
			: 'const ' // ref:xxx -> const xxx
		addReplace(label.label.start, label.label.end + 1, labelReplace);

		for (const binary of label.binarys) {

			// ref: ({ ... }) -> ref: { ... }
			addReplace(binary.parent.start, binary.left.start, '');
			addReplace((binary.right ?? binary.left).end, binary.parent.end, '');

			if (!binary.right) {
				// ref: xxx -> ref: xxx = ref()
				addReplace(binary.left.end, binary.left.end, ' = ref()');
			}
			else if (
				!binary.right.isComputedCall
				&& !scriptSetup.content.substring(binary.left.start, binary.left.end).startsWith('{') // TODO
			) {
				// ref: foo = bar as baz -> ref: foo = ref<baz>(bar)
				if (binary.right.as) {

					let rightType = scriptSetup.content.substring(binary.right.as.start, binary.right.as.end);

					if (rightType.startsWith('undefined | '))
						rightType = rightType.substr('undefined | '.length);
					else if (rightType.endsWith(' | undefined'))
						rightType = rightType.substr(0, rightType.length - ' | undefined'.length);

					addReplace(binary.right.start, binary.right.start, `ref<${rightType}>(`);
					addReplace(binary.right.withoutAs.end, binary.right.as.end, ')');
				}
				else {
					addReplace(binary.right.start, binary.right.start, `ref(`);
					addReplace(binary.right.end, binary.right.end, `)`);
				}
				if (scriptSetup.content.substring(binary.right.withoutAs.start, binary.right.withoutAs.end) === 'undefined') {
					addReplace(binary.right.withoutAs.start, binary.right.withoutAs.end, ``);
				}
				hasNewRefCall = true;
			}

			for (const _var of binary.vars) {

				if (progress?.token.isCancellationRequested)
					return edits;

				const varText = scriptSetup.content.substring(_var.start, _var.end);
				progress?.report(++varsCur / varsNum * 100, varText);
				await shared.sleep(0);

				const references = findReferences(_var.start);
				for (const reference of references) {

					if (reference.uri !== document.uri)
						continue;

					const refernceRange = {
						start: document.offsetAt(reference.range.start) - scriptSetup.loc.start,
						end: document.offsetAt(reference.range.end) - scriptSetup.loc.start,
					};

					if (refernceRange.start === _var.start && refernceRange.end === _var.end)
						continue;

					if (refernceRange.start < 0 || refernceRange.end > scriptSetup.content.length)
						continue;

					const referenceText = scriptSetup.content.substring(refernceRange.start, refernceRange.end);
					const isRaw = `$${varText}` === referenceText;
					const isShorthand = genData2.shorthandPropertys.some(p => p.start === refernceRange.start && p.end === refernceRange.end);

					if (isRaw) {
						addReplace(refernceRange.start, refernceRange.end, isShorthand ? `$${varText}: ${varText}` : varText);
					}
					else {
						addReplace(refernceRange.start, refernceRange.end, isShorthand ? `${varText}: ${varText}` : varText);
						addReplace(refernceRange.end, refernceRange.end, `.value`);
					}
				}
			}
		}
	}

	if (hasNewRefCall) {

		const scriptDoc = sourceFile.getScriptTsDocument();
		const scriptSourceMap = sourceFile.getScriptTsSourceMap();

		if (scriptDoc && scriptSourceMap) {

			const refOffset = scriptDoc.getText().indexOf(SearchTexts.Ref);
			const items = await scriptTsLs.doComplete(scriptDoc.uri, scriptDoc.positionAt(refOffset), { includeCompletionsForModuleExports: true });

			for (let item of items) {

				if (item.label !== 'ref')
					continue;

				item = await scriptTsLs.doCompletionResolve(item);

				if (!item.additionalTextEdits)
					continue;

				for (const edit of item.additionalTextEdits) {
					const vueRange = scriptSourceMap.getSourceRange(edit.range.start, edit.range.end);
					if (vueRange) {
						edits.push({
							range: vueRange,
							newText: edit.newText,
						});
					}
				}
			}
		}
	}

	return edits;

	function addReplace(start: number, end: number, text: string) {

		if (scriptSetup.content.substring(start, end) === text)
			return;

		edits.push(vscode.TextEdit.replace(
			{
				start: document.positionAt(scriptSetup.loc.start + start),
				end: document.positionAt(scriptSetup.loc.start + end),
			},
			text
		));
	}
	function findReferences(offset: number) {
		return _findReferences(document.uri, document.positionAt(scriptSetup.loc.start + offset));
	}
}
