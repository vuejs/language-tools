import {
	Range,
	TextEdit,
	Connection,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import { Commands } from '../commands';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { pugToHtml, htmlToPug } from '@volar/pug';
import { ShowReferencesNotification, sleep } from '@volar/shared';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import { SearchTexts } from '../virtuals/common';
import * as findReferences from './references';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	const _findReferences = findReferences.register(sourceFiles, tsLanguageService);
	return async (document: TextDocument, command: string, args: any[] | undefined, connection: Connection) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		if (command === Commands.SHOW_REFERENCES && args) {
			const uri = args[0];
			const pos = args[1];
			const locs = args[2];
			connection.sendNotification(ShowReferencesNotification.type, { uri, position: pos, references: locs });
		}
		if (command === Commands.SWITCH_REF_SUGAR) {
			const desc = sourceFile.getDescriptor();
			if (!desc.scriptSetup) return;
			const genData = sourceFile.getScriptSetupData();
			if (!genData) return;
			let edits: TextEdit[] = [];
			if (genData.data.labels.length) {
				// unuse ref sugar
				let varsNum = 0;
				let varsCur = 0;
				for (const label of genData.data.labels) {
					for (const binary of label.binarys) {
						varsNum += binary.vars.length;
					}
				}
				const progress = await connection.window.createWorkDoneProgress();
				progress.begin('Unuse Ref Sugar', 0, '', true);
				for (const label of genData.data.labels) {
					edits.push(TextEdit.replace({
						start: document.positionAt(desc.scriptSetup.loc.start + label.label.start),
						end: document.positionAt(desc.scriptSetup.loc.start + label.label.end + 1),
					}, 'const'));
					for (const binary of label.binarys) {
						edits.push(TextEdit.del({
							start: document.positionAt(desc.scriptSetup.loc.start + binary.parent.start),
							end: document.positionAt(desc.scriptSetup.loc.start + binary.left.start),
						}));
						edits.push(TextEdit.del({
							start: document.positionAt(desc.scriptSetup.loc.start + binary.parent.end),
							end: document.positionAt(desc.scriptSetup.loc.start + (binary.right ?? binary.left).end),
						}));
						if (!binary.right) {
							edits.push(TextEdit.insert(
								document.positionAt(desc.scriptSetup.loc.start + binary.left.end),
								' = ref()'
							));
						}
						else if (
							!binary.right.isComputedCall
							&& !document.getText().substring(desc.scriptSetup.loc.start + binary.left.start, desc.scriptSetup.loc.start + binary.left.end).startsWith('{') // TODO
						) {
							edits.push(TextEdit.insert(
								document.positionAt(desc.scriptSetup.loc.start + binary.right.start),
								'ref('
							));
							edits.push(TextEdit.insert(
								document.positionAt(desc.scriptSetup.loc.start + binary.right.end),
								')'
							));
						}
						for (const _var of binary.vars) {
							if (progress.token.isCancellationRequested) {
								return;
							}
							const varRange = {
								start: document.positionAt(desc.scriptSetup.loc.start + _var.start),
								end: document.positionAt(desc.scriptSetup.loc.start + _var.end),
							};
							const varText = document.getText(varRange);
							progress.report(++varsCur / varsNum * 100, varText);
							await sleep(0);
							const references = _findReferences(document, varRange.start) ?? [];
							for (const reference of references) {
								if (reference.uri !== document.uri)
									continue;
								const refernceRange = {
									start: document.offsetAt(reference.range.start),
									end: document.offsetAt(reference.range.end),
								};
								if (refernceRange.start === desc.scriptSetup.loc.start + _var.start && refernceRange.end === desc.scriptSetup.loc.start + _var.end)
									continue;
								if (refernceRange.start >= desc.scriptSetup.loc.start && refernceRange.end <= desc.scriptSetup.loc.end) {
									const referenceText = document.getText().substring(refernceRange.start, refernceRange.end);
									const isRaw = `$${varText}` === referenceText;
									let isShorthand = false;
									for (const shorthandProperty of genData.data.shorthandPropertys) {
										if (
											refernceRange.start === desc.scriptSetup.loc.start + shorthandProperty.start
											&& refernceRange.end === desc.scriptSetup.loc.start + shorthandProperty.end
										) {
											isShorthand = true;
											break;
										}
									}
									if (isRaw) {
										edits.push(TextEdit.replace(reference.range, isShorthand ? `$${varText}: ${varText}` : varText));
									}
									else {
										edits.push(TextEdit.replace(reference.range, isShorthand ? `${varText}: ${varText}.value` : `${varText}.value`));
									}
								}
							}
						}
					}
				}
				const script = sourceFile.getVirtualScript();
				if (!script.document || !script.sourceMap) return;
				const refOffset = script.document.getText().indexOf(SearchTexts.Ref);
				const items = tsLanguageService.doComplete(script.document.uri, script.document.positionAt(refOffset), { includeCompletionsForModuleExports: true });
				for (let item of items) {
					if (item.label !== 'ref')
						continue;
					item = tsLanguageService.doCompletionResolve(item);
					if (!item.data.importModule)
						continue;
					if (!item.additionalTextEdits)
						continue;
					for (const edit of item.additionalTextEdits) {
						const vueLoc = script.sourceMap.targetToSource(edit.range);
						if (!vueLoc)
							continue;
						edits.push({
							range: vueLoc.range,
							newText: edit.newText,
						});
					}
				}
				progress.done();
			}
			else {
				// use ref sugar
				let varsNum = 0;
				let varsCur = 0;
				for (const label of genData.data.refCalls) {
					varsNum += label.vars.length;
				}
				const progress = await connection.window.createWorkDoneProgress();
				progress.begin('Use Ref Sugar', 0, '', true);
				for (const refCall of genData.data.refCalls) {
					const left = document.getText().substring(
						desc.scriptSetup.loc.start + refCall.left.start,
						desc.scriptSetup.loc.start + refCall.left.end,
					);
					const right = document.getText().substring(
						desc.scriptSetup.loc.start + refCall.rightExpression.start,
						desc.scriptSetup.loc.start + refCall.rightExpression.end,
					);
					if (left.trim().startsWith('{')) {
						edits.push(TextEdit.replace({
							start: document.positionAt(desc.scriptSetup.loc.start + refCall.start),
							end: document.positionAt(desc.scriptSetup.loc.start + refCall.end),
						}, `ref: (${left} = ${right})`));
					}
					else {
						edits.push(TextEdit.replace({
							start: document.positionAt(desc.scriptSetup.loc.start + refCall.start),
							end: document.positionAt(desc.scriptSetup.loc.start + refCall.end),
						}, `ref: ${left} = ${right}`));
					}
					for (const _var of refCall.vars) {
						if (progress.token.isCancellationRequested) {
							return;
						}
						const varRange = {
							start: document.positionAt(desc.scriptSetup.loc.start + _var.start),
							end: document.positionAt(desc.scriptSetup.loc.start + _var.end),
						};
						const varText = document.getText(varRange);
						progress.report(++varsCur / varsNum * 100, varText);
						await sleep(0);
						const references = _findReferences(document, varRange.start) ?? [];
						for (const reference of references) {
							if (reference.uri !== document.uri)
								continue;
							const refernceRange = {
								start: document.offsetAt(reference.range.start),
								end: document.offsetAt(reference.range.end),
							};
							if (refernceRange.start === desc.scriptSetup.loc.start + _var.start && refernceRange.end === desc.scriptSetup.loc.start + _var.end)
								continue;
							if (refernceRange.start >= desc.scriptSetup.loc.start && refernceRange.end <= desc.scriptSetup.loc.end) {
								const withDotValue = document.getText().substr(refernceRange.end, '.value'.length) === '.value';
								if (withDotValue) {
									edits.push(TextEdit.replace({
										start: reference.range.start,
										end: document.positionAt(refernceRange.end + '.value'.length),
									}, varText));
								}
								else {
									edits.push(TextEdit.replace(reference.range, '$' + varText));
								}
							}
						}
					}
				}
				progress.done();
			}
			connection.workspace.applyEdit({ changes: { [document.uri]: edits } });
		}
		if (command === Commands.HTML_TO_PUG) {
			const desc = sourceFile.getDescriptor();
			if (!desc.template) return;
			const lang = desc.template.lang;
			if (lang !== 'html') return;

			const pug = htmlToPug(desc.template.content) + '\n';
			const newTemplate = `<template lang="pug">` + pug;

			let start = desc.template.loc.start - '<template>'.length;
			const end = desc.template.loc.end;
			const startMatch = '<template';

			while (!document.getText(Range.create(
				document.positionAt(start),
				document.positionAt(start + startMatch.length),
			)).startsWith(startMatch)) {
				start--;
				if (start < 0) {
					throw `Can't find start of tag <template>`
				}
			}

			const range = Range.create(
				document.positionAt(start),
				document.positionAt(end),
			);
			const textEdit = TextEdit.replace(range, newTemplate);
			connection.workspace.applyEdit({ changes: { [document.uri]: [textEdit] } });
		}
		if (command === Commands.PUG_TO_HTML) {
			const desc = sourceFile.getDescriptor();
			if (!desc.template) return;
			const lang = desc.template.lang;
			if (lang !== 'pug') return;

			let html = pugToHtml(desc.template.content);
			const newTemplate = `<template>\n` + html;

			let start = desc.template.loc.start - '<template>'.length;
			const end = desc.template.loc.end;
			const startMatch = '<template';

			while (!document.getText(Range.create(
				document.positionAt(start),
				document.positionAt(start + startMatch.length),
			)).startsWith(startMatch)) {
				start--;
				if (start < 0) {
					throw `Can't find start of tag <template>`
				}
			}

			const range = Range.create(
				document.positionAt(start),
				document.positionAt(end),
			);
			const textEdit = TextEdit.replace(range, newTemplate);
			connection.workspace.applyEdit({ changes: { [document.uri]: [textEdit] } });
		}
	}
}
