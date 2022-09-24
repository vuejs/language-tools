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

				const codeLens = await plugin.codeLens?.on?.(document);

				if (codeLens) {
					return codeLens.map<vscode.CodeLens>(item => {
						const commandArgs: ExecutePluginCommandArgs | undefined = item.command ? [uri, context.plugins.indexOf(plugin), item.command] : undefined;
						return {
							...item,
							command: item.command && commandArgs ? {
								...item.command,
								command: executePluginCommand,
								arguments: commandArgs as any,
							} : undefined,
							data: {
								uri,
								originalItem: item,
								pluginId: context.plugins.indexOf(plugin),
							} satisfies PluginCodeLensData,
						};
					});
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
	};
}
