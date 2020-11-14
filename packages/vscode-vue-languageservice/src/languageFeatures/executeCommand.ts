import {
	Range,
	TextEdit,
	Connection,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { Commands } from '../commands';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { pugToHtml, htmlToPug } from '@volar/pug';
import { ShowReferencesNotification } from '@volar/shared';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, command: string, args: any[] | undefined, connection: Connection) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;


		if (command === Commands.SHOW_REFERENCES && args) {
			const uri = args[0];
			const pos = args[1];
			const locs = args[2];
			connection.sendNotification(ShowReferencesNotification.type, { uri, position: pos, references: locs });
		}
		if (command === Commands.UNUSE_REF_SUGAR) {
			const desc = sourceFile.getDescriptor();
			if (!desc.scriptSetup) return;
			const genData = sourceFile.getScriptSetupData();
			if (!genData) return;
			let edits: TextEdit[] = [];
			edits.push(TextEdit.replace({
				start: document.positionAt(desc.scriptSetup.loc.start),
				end: document.positionAt(desc.scriptSetup.loc.start),
			}, `\nimport { ref } from 'vue'\n`));
			for (const label of genData.data.labels) {
				edits.push(TextEdit.replace({
					start: document.positionAt(desc.scriptSetup.loc.start + label.label.start),
					end: document.positionAt(desc.scriptSetup.loc.start + label.label.end + 1),
				}, 'const'));
				edits.push(TextEdit.replace({
					start: document.positionAt(desc.scriptSetup.loc.start + label.right.start),
					end: document.positionAt(desc.scriptSetup.loc.start + label.right.start),
				}, 'ref('));
				edits.push(TextEdit.replace({
					start: document.positionAt(desc.scriptSetup.loc.start + label.right.end),
					end: document.positionAt(desc.scriptSetup.loc.start + label.right.end),
				}, ')'));
				for (const _var of label.vars) {
					for (const reference of _var.references) {
						edits.push(TextEdit.replace({
							start: document.positionAt(desc.scriptSetup.loc.start + reference.end),
							end: document.positionAt(desc.scriptSetup.loc.start + reference.end),
						}, '.value'));
					}
				}
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
