import * as vscode from 'vscode-languageserver-protocol';
import { LanguageServicePlugin, LanguageServicePluginContext, DocumentsAndSourceMaps } from '@volar/language-service';
import { htmlToPug, pugToHtml } from '@johnsoncodehk/html2pug';
import * as vue from '@volar/vue-language-core';

const toggleConvertCommand = 'htmlPugConversions.toggle';

export interface ReferencesCodeLensData {
	uri: string,
	position: vscode.Position,
}

type CommandArgs = [string];

export default function (options: {
	documents: DocumentsAndSourceMaps,
}): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		codeLens: {

			on(document) {
				return worker(document.uri, async (vueSourceFile) => {

					const isEnabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.codeLens.pugTools') ?? true;

					if (!isEnabled)
						return;

					const descriptor = vueSourceFile.sfc;

					if (descriptor.template && (descriptor.template.lang === 'html' || descriptor.template.lang === 'pug')) {

						return [{
							range: {
								start: document.positionAt(descriptor.template.start),
								end: document.positionAt(descriptor.template.startTagEnd),
							},
							command: {
								title: 'pug ' + (descriptor.template.lang === 'pug' ? '☑' : '☐'),
								command: toggleConvertCommand,
								arguments: <CommandArgs>[document.uri],
							},
						}];
					}
				});
			},
		},

		doExecuteCommand(command, args, host) {

			if (command === toggleConvertCommand) {

				const [uri] = args as CommandArgs;

				return worker(uri, (vueFile) => {

					const document = options.documents.getDocumentByFileName(vueFile.snapshot, vueFile.fileName);
					const desc = vueFile.sfc;
					if (!desc.template)
						return;

					const lang = desc.template.lang;

					if (lang === 'html') {

						const pug = htmlToPug(desc.template.content) + '\n';
						const newTemplate = `<template lang="pug">` + pug;
						const range = vscode.Range.create(
							document.positionAt(desc.template.start),
							document.positionAt(desc.template.startTagEnd + desc.template.content.length),
						);
						const textEdit = vscode.TextEdit.replace(range, newTemplate);

						host.applyEdit({ changes: { [document.uri]: [textEdit] } });
					}
					else if (lang === 'pug') {

						const html = pugToHtml(desc.template.content);
						const newTemplate = `<template>\n` + html + `\n`;
						const range = vscode.Range.create(
							document.positionAt(desc.template.start),
							document.positionAt(desc.template.startTagEnd + desc.template.content.length),
						);
						const textEdit = vscode.TextEdit.replace(range, newTemplate);

						host.applyEdit({ changes: { [document.uri]: [textEdit] } });
					}
				});
			}
		},
	};

	function worker<T>(uri: string, callback: (vueSourceFile: vue.VueFile) => T) {

		const virtualFile = options.documents.getVirtualFileByUri(uri);
		if (!(virtualFile instanceof vue.VueFile))
			return;

		return callback(virtualFile);
	}
}
