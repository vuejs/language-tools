import type { LanguageServiceRuntimeContext } from '../types';
import { ExecuteCommandContext } from '@volar/language-service';
import * as vscode from 'vscode-languageserver-protocol';

export const executePluginCommand = 'volar.executtePluginCommand';

export type ExecutePluginCommandArgs = [
	string, // uri
	number | undefined, // plugin id
	vscode.Command, // original command
];

export function register(context: LanguageServiceRuntimeContext) {

	return async (command: string, args: ExecutePluginCommandArgs, executeCommandContext: ExecuteCommandContext) => {

		if (command === executePluginCommand) {

			const [_uri, pluginId, originalCommand] = args as ExecutePluginCommandArgs;

			if (pluginId !== undefined) {

				const plugin = context.plugins[pluginId];

				await plugin?.doExecuteCommand?.(originalCommand.command, originalCommand.arguments as any, executeCommandContext);
			}
			else {

				for (const plugin of context.plugins) {

					await plugin.doExecuteCommand?.(originalCommand.command, originalCommand.arguments as any, executeCommandContext);
				}
			}
		}
	};
}
