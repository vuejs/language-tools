import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import * as vscode from 'vscode-languageserver';
import { pugToHtml } from '@volar/html2pug';

export function execute(document: TextDocument, sourceFile: SourceFile, connection: vscode.Connection) {
	const desc = sourceFile.getDescriptor();
	if (!desc.template) return;
	const lang = desc.template.lang;
	if (lang !== 'pug') return;

	const html = pugToHtml(desc.template.content);
	const newTemplate = `<template>\n` + html + `\n`;

	const range = vscode.Range.create(
		document.positionAt(desc.template.start),
		document.positionAt(desc.template.startTagEnd + desc.template.content.length),
	);
	const textEdit = vscode.TextEdit.replace(range, newTemplate);
	connection.workspace.applyEdit({ changes: { [document.uri]: [textEdit] } });
}
