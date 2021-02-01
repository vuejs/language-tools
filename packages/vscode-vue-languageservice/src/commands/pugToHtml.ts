import type { Connection } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import { TextEdit } from 'vscode-languageserver/node';
import { Range } from 'vscode-languageserver/node';
import { pugToHtml } from '@volar/pug';

export function execute(document: TextDocument, sourceFile: SourceFile, connection: Connection) {
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
