import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { PluginCodeLensData } from './codeLens';
import { executePluginCommand, ExecutePluginCommandArgs } from './executeCommand';

export function register(context: LanguageServiceRuntimeContext) {

	return async (item: vscode.CodeLens) => {

		const data: PluginCodeLensData = item.data as any;

		if (data) {

			const plugin = context.getPluginById(data.pluginId);

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
					arguments: <ExecutePluginCommandArgs>[data.uri, plugin.id, resolvedOriginalItem.command],
				} : undefined,
				range: item.range, // range already transform in codeLens request
			};
		}

		return item;
	}
}
