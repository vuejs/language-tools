import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import { executePluginCommand, ExecutePluginCommandArgs } from './executeCommand';

export interface PluginCodeLensData {
	uri: string,
	originalItem: vscode.CodeLens,
	pluginId: number,
}

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string) => {

		return await languageFeatureWorker(
			context,
			uri,
			undefined,
			(arg, sourceMap) => [arg],
			async (plugin, document, arg, sourceMap) => {

				const codeLens = await plugin.doCodeLens?.(document);

				if (codeLens) {
					return codeLens.map(item => (<vscode.CodeLens>{
						...item,
						command: item.command ? {
							...item.command,
							command: executePluginCommand,
							arguments: <ExecutePluginCommandArgs>[uri, plugin.id, item.command],
						} : undefined,
						data: <PluginCodeLensData>{
							uri,
							originalItem: item,
							pluginId: plugin.id,
							sourceMapId: sourceMap?.id,
							embeddedDocumentUri: sourceMap?.mappedDocument.uri,
						} as any,
					}));
				}
			},
			(data, sourceMap) => data.map(codeLens => {

				if (!sourceMap)
					return codeLens;

				const range = sourceMap.getSourceRange(codeLens.range.start, codeLens.range.end)?.[0];
				if (range) {
					return {
						...codeLens,
						range,
					};
				}
			}).filter(shared.notEmpty),
			arr => arr.flat(),
		) ?? [];
	}
}
