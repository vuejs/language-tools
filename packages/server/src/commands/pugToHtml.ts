import * as vscode from 'vscode-languageserver-protocol';
import type { Connection } from 'vscode-languageserver';
import { pugToHtml } from '@volar/html2pug';
import * as vue from '@volar/vue-language-service';

export async function execute(
	vueLs: vue.LanguageService,
	connection: Connection,
	uri: string,
) {

	const sourceFile = vueLs.__internal__.context.vueDocuments.get(uri);
	if (!sourceFile) return;

	const document = sourceFile.getTextDocument();
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
