import { ServiceContext } from '@volar/language-service';
import { VueFile } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import { posix as path } from 'path';
import type * as vscode from 'vscode-languageserver-protocol';
import { createAddComponentToOptionEdit, getLastImportNode } from '../plugins/vue-extract-file';

export function getDragImportEdits(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ctx: ServiceContext,
	uri: string,
	importUri: string,
	tagName: string
) {

	const newName = capitalize(camelize(tagName));
	const document = ctx!.getTextDocument(uri)!;
	const [vueFile] = ctx!.documents.getVirtualFileByUri(document.uri) as [VueFile, any];
	const { sfc } = vueFile;
	const script = sfc.scriptSetup ?? sfc.script;

	if (!sfc.template || !script)
		return [];

	const lastImportNode = getLastImportNode(ts, script.ast);
	const edits: vscode.TextEdit[] = [
		{
			range: lastImportNode ? {
				start: document.positionAt(script.startTagEnd + lastImportNode.end),
				end: document.positionAt(script.startTagEnd + lastImportNode.end),
			} : {
				start: document.positionAt(script.startTagEnd),
				end: document.positionAt(script.startTagEnd),
			},
			newText: `\nimport ${newName} from './${path.relative(path.dirname(uri), importUri) || importUri.substring(importUri.lastIndexOf('/') + 1)}'`,
		},
	];

	if (sfc.script) {
		const edit = createAddComponentToOptionEdit(ts, sfc.script.ast, newName);
		if (edit) {
			edits.push({
				range: {
					start: document.positionAt(sfc.script.startTagEnd + edit.range.start),
					end: document.positionAt(sfc.script.startTagEnd + edit.range.end),
				},
				newText: edit.newText,
			});
		}
	}

	return edits;
}
