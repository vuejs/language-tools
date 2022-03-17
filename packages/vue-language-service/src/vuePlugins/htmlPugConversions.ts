import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import { htmlToPug, pugToHtml } from '@volar/html2pug';
import { VueDocument } from '../vueDocuments';

const toggleConvertCommand = 'htmlPugConversions.toggle';

export interface ReferencesCodeLensData {
    uri: string,
    position: vscode.Position,
}

type CommandArgs = [string];

export default function (host: {
    getSettings: <S>(section: string, scopeUri?: string | undefined) => Promise<S | undefined>,
    getVueDocument(uri: string): VueDocument | undefined,
}): EmbeddedLanguagePlugin {

    return {

        doCodeLens(document) {
            return worker(document.uri, async (vueDocument) => {

                const isEnabled = await host.getSettings<boolean>('volar.codeLens.pugTools') ?? true;

                if (!isEnabled)
                    return;

                const result: vscode.CodeLens[] = [];
                const embeddedTemplate = vueDocument.file.getEmbeddedTemplate();

                if (embeddedTemplate && (embeddedTemplate.file.lang === 'html' || embeddedTemplate.file.lang === 'pug')) {

                    const sourceMap = vueDocument.sourceMapsMap.get(embeddedTemplate);

                    for (const maped of sourceMap.mappings) {
                        return [{
                            range: {
                                start: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
                                end: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
                            },
                            command: {
                                title: 'pug ' + (embeddedTemplate.file.lang === 'pug' ? '☑' : '☐'),
                                command: toggleConvertCommand,
                                arguments: <CommandArgs>[document.uri],
                            },
                        }];
                    }
                }

                return result;
            });
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

        const vueDocument = host.getVueDocument(uri);
        if (!vueDocument)
            return;

        return callback(vueDocument);
    }
}
