import * as vscode from 'vscode-languageserver-protocol';
import type { Connection } from 'vscode-languageserver';
import { htmlToPug } from '@volar/html2pug';
import * as vue from 'vscode-vue-languageservice';

export async function execute(
	vueLs: vue.LanguageService,
	connection: Connection,
	uri: string,
) {

	const sourceFile = vueLs.__internal__.context.sourceFiles.get(uri);
	if (!sourceFile) return;

	const document = sourceFile.getTextDocument();
	const desc = sourceFile.getDescriptor();
	if (!desc.template) return;
	const lang = desc.template.lang;
	if (lang !== 'html') return;

	const pug = htmlToPug(desc.template.content) + '\n';
	const newTemplate = `<template lang="pug">` + pug;
	const range = vscode.Range.create(
		document.positionAt(desc.template.start),
		document.positionAt(desc.template.startTagEnd + desc.template.content.length),
	);
	const textEdit = vscode.TextEdit.replace(range, newTemplate);
	connection.workspace.applyEdit({ changes: { [document.uri]: [textEdit] } });
}
