import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import * as vscode from 'vscode-languageserver-protocol';
import type { Connection } from 'vscode-languageserver';
import { htmlToPug } from '@volar/html2pug';

export function execute(document: TextDocument, sourceFile: SourceFile, connection: Connection) {
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
