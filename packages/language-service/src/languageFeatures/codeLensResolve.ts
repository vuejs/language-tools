import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { PluginCodeLensData } from './codeLens';
import { executePluginCommand, ExecutePluginCommandArgs } from './executeCommand';

export function register(context: LanguageServiceRuntimeContext) {

	return async (item: vscode.CodeLens) => {

		const data: PluginCodeLensData = item.data;

		if (data) {

			const plugin = context.plugins[data.pluginId];

			if (!plugin)
				return item;

			if (!plugin.codeLens?.resolve)
				return item;

			const resolvedOriginalItem = await plugin.codeLens.resolve(data.originalItem);

			item = <vscode.CodeLens>{
				...resolvedOriginalItem,
				command: resolvedOriginalItem.command ? {
					...resolvedOriginalItem.command,
					command: executePluginCommand,
					arguments: <ExecutePluginCommandArgs>[data.uri, context.plugins.indexOf(plugin), resolvedOriginalItem.command],
				} : undefined,
				range: item.range, // range already transformed in codeLens request
			};
		}

		return item;
	};
}
