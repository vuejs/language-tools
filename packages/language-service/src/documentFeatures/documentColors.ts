import type { DocumentServiceRuntimeContext } from '../types';
import { documentFeatureWorker } from '../utils/featureWorkers';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

export function register(context: DocumentServiceRuntimeContext) {

	return (document: TextDocument) => {

		return documentFeatureWorker(
			context,
			document,
			(file) => !!file.capabilities.documentSymbol, // TODO: add color capabilitie setting
			(plugin, document) => plugin.findDocumentColors?.(document),
			(data, map) => data.map(color => {
				const range = map.toSourceRange(color.range);
				if (range) {
					console.log(map.sourceFileDocument.uri, map.virtualFileDocument.uri, color.color);
					return vscode.ColorInformation.create(range, color.color);
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		);
	};
}
