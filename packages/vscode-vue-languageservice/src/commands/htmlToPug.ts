import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import * as vscode from 'vscode-languageserver';
import { htmlToPug } from '@volar/html2pug';

export function execute(document: TextDocument, sourceFile: SourceFile, connection: vscode.Connection) {
	const desc = sourceFile.getDescriptor();
	if (!desc.template) return;
	const lang = desc.template.lang;
	if (lang !== 'html') return;

	const pug = htmlToPug(desc.template.content) + '\n';
	const newTemplate = `<template lang="pug">` + pug;

	let start = desc.template.loc.start - '<template>'.length;
	const end = desc.template.loc.end;
	const startMatch = '<template';

	while (!document.getText(vscode.Range.create(
		document.positionAt(start),
		document.positionAt(start + startMatch.length),
	)).startsWith(startMatch)) {
		start--;
		if (start < 0) {
			throw `Can't find start of tag <template>`
		}
	}

	const range = vscode.Range.create(
		document.positionAt(start),
		document.positionAt(end),
	);
	const textEdit = vscode.TextEdit.replace(range, newTemplate);
	connection.workspace.applyEdit({ changes: { [document.uri]: [textEdit] } });
}
