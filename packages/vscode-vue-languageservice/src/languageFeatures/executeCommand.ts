import {
	Range,
	TextEdit,
	Connection,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { Commands } from '../commands';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { pugToHtml, htmlToPug } from '@volar/pug';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, command: string, connection: Connection) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const desc = sourceFile.getDescriptor();
		if (!desc.template) return;

		const lang = desc.template.lang;

		if (command === Commands.HTML_TO_PUG) {
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
