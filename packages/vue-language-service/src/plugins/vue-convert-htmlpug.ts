import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguageServicePlugin, useConfigurationHost } from '@volar/vue-language-service-types';
import { htmlToPug, pugToHtml } from '@johnsoncodehk/html2pug';
import { VueDocument } from '../vueDocuments';

const toggleConvertCommand = 'htmlPugConversions.toggle';

export interface ReferencesCodeLensData {
	uri: string,
	position: vscode.Position,
}

type CommandArgs = [string];

export default function (options: {
	getVueDocument(uri: string): VueDocument | undefined,
}): EmbeddedLanguageServicePlugin {

	return {

		codeLens: {

			on(document) {
				return worker(document.uri, async (vueDocument) => {

					const isEnabled = await useConfigurationHost()?.getConfiguration<boolean>('volar.codeLens.pugTools') ?? true;

					if (!isEnabled)
						return;

					const descriptor = vueDocument.file.getDescriptor();

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

				return worker(uri, vueDocument => {

					const document = vueDocument.getDocument();
					const desc = vueDocument.file.getDescriptor();
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

	function worker<T>(uri: string, callback: (vueDocument: VueDocument) => T) {

		const vueDocument = options.getVueDocument(uri);
		if (!vueDocument || vueDocument.file.fileName.endsWith('.md'))
			return;

		return callback(vueDocument);
	}
}
