import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { PluginCodeLensData } from './codeLens';

export function register(context: LanguageServiceRuntimeContext) {

	return async (item: vscode.CodeLens) => {

		const data: PluginCodeLensData = item.data as any;

		if (data) {

			const plugin = context.getPluginById(data.pluginId);

			if (!plugin)
				return item;

			if (!plugin.doCodeLensResolve)
				return item;

			const resolvedOriginalItem = await plugin.doCodeLensResolve(data.originalItem);

			item = {
				...resolvedOriginalItem,
				range: item.range, // range already transform in codeLens request
			};
		}

		return item;
	}
}
