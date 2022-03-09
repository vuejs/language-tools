import * as vscode from 'vscode';
import { ResponseError } from 'vscode-languageclient';
import * as shared from '@volar/shared';
import type { CommonLanguageClient } from 'vscode-languageclient';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export async function activate(context: vscode.ExtensionContext, languageClient: CommonLanguageClient) {

	await languageClient.onReady();
	const schemaDocuments: { [uri: string]: boolean } = {};

	context.subscriptions.push(languageClient.onRequest(shared.GetDocumentContentRequest.type, handle => {
		const uri = vscode.Uri.parse(handle.uri);
		if (uri.scheme === 'untitled') {
			return Promise.reject(new ResponseError(3, localize('untitled.schema', 'Unable to load {0}', uri.toString())));
		}
		if (uri.scheme !== 'http' && uri.scheme !== 'https') {
			return vscode.workspace.openTextDocument(uri).then(doc => {
				schemaDocuments[uri.toString()] = true;
				return doc.getText();
			}, error => {
				return Promise.reject(new ResponseError(2, error.toString()));
			});
		}
		// else if (schemaDownloadEnabled) {
		//     if (runtime.telemetry && uri.authority === 'schema.management.azure.com') {
		//         /* __GDPR__
		//             "json.schema" : {
		//                 "schemaURL" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		//             }
		//          */
		//         runtime.telemetry.sendTelemetryEvent('json.schema', { schemaURL: uriPath });
		//     }
		//     return runtime.http.getContent(uriPath);
		// }
		else {
			// return Promise.reject(new ResponseError(1, localize('schemaDownloadDisabled', 'Downloading schemas is disabled through setting \'{0}\'', SettingIds.enableSchemaDownload)));
			return Promise.reject(new ResponseError(0, 'Downloading schemas is not support yet'));
		}
	}));
}
