import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import type { LanguageService as TsLanguageService } from 'vscode-typescript-languageservice';
import * as shared from '@volar/shared';
import { SearchTexts } from '../utils/string';
import { parseRefSugarRanges } from '../parsers/scriptSetupRanges';
import { isRefType } from '../services/refAutoClose';

export async function execute(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	document: TextDocument,
	sourceFile: SourceFile,
	connection: vscode.Connection,
	_findReferences: (uri: string, position: vscode.Position) => vscode.Location[],
	_findTypeDefinition: (uri: string, position: vscode.Position) => vscode.LocationLink[],
	tsLs: TsLanguageService,
) {
	const desc = sourceFile.getDescriptor();
	if (!desc.scriptSetup) return;

	const genData = sourceFile.getScriptSetupData();
	if (!genData) return;

	const descriptor = sourceFile.getDescriptor();
	if (!descriptor.scriptSetup) return;

	const genData2 = parseRefSugarRanges(ts, descriptor.scriptSetup.content, descriptor.scriptSetup.lang);
	let varsNum = 0;
	let varsCur = 0;
	for (const label of genData.labels) {
		for (const binary of label.binarys) {
			varsNum += binary.vars.length;
		}
	}
	const progress = await connection.window.createWorkDoneProgress();
	progress.begin('Unuse Ref Sugar', 0, '', true);

	const scriptSetup = descriptor.scriptSetup;
	const edits: vscode.TextEdit[] = [];
	const dotValueOffsets_1: number[] = [];
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

				if (progress.token.isCancellationRequested)
					return;

				const varText = scriptSetup.content.substring(_var.start, _var.end);
				progress.report(++varsCur / varsNum * 100, varText);
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
						dotValueOffsets_1.push(refernceRange.end);
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
			const items = await tsLs.doComplete(scriptDoc.uri, scriptDoc.positionAt(refOffset), { includeCompletionsForModuleExports: true });

			for (let item of items) {

				if (item.label !== 'ref')
					continue;

				item = await tsLs.doCompletionResolve(item);

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

	const dotValueOffsets_2 = dotValueOffsets_1.map(offset => {
		let newOffset = offset;
		for (const replace of edits) {
			const end = document.offsetAt(replace.range.end);
			if (scriptSetup.loc.start + offset >= end) {
				const start = document.offsetAt(replace.range.start);
				const oldLength = end - start;
				const newLength = replace.newText.length;
				newOffset += newLength - oldLength;
			}
		}
		return newOffset;
	});

	if (edits.length) {

		const lastProjectVersion = tsLs.__internal__.host.getProjectVersion!();
		const newDocumentText = TextDocument.applyEdits(document, edits);
		await connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
		document = TextDocument.create(document.uri, document.languageId, document.version, newDocumentText);

		while (true) {

			await shared.sleep(100);

			if (progress.token.isCancellationRequested)
				return;

			if (tsLs.__internal__.host.getProjectVersion!() !== lastProjectVersion)
				break;
		}

		edits.length = 0;

		for (const offset of dotValueOffsets_2) {

			if (progress.token.isCancellationRequested)
				return;

			if (!isRef(offset - '.value'.length)) {
				addReplace(offset - '.value'.length, offset, '');
			}
		}

		if (edits.length) {
			await connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
		}
	}

	progress.done();

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
	function isRef(offset: number) {
		const typeDefs = _findTypeDefinition(document.uri, document.positionAt(scriptSetup.loc.start + offset));
		return isRefType(typeDefs, tsLs);
	}
}
