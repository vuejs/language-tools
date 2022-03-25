import type { LanguageServiceRuntimeContext } from '../types';
import { embeddedEditToSourceEdit } from './rename';
import type * as _ from 'vscode-languageserver-protocol';

export function register(context: LanguageServiceRuntimeContext) {

	return async (oldUri: string, newUri: string) => {

		const vueDocument = context.vueDocuments.get(oldUri);

		if (vueDocument) {
			oldUri += '.ts';
			newUri += '.ts';
		}

		const plugins = context.getPlugins('script');

		for (const plugin of plugins) {

			if (!plugin.doFileRename)
				continue;

			const workspaceEdit = await plugin.doFileRename(oldUri, newUri);

			if (workspaceEdit) {
				return embeddedEditToSourceEdit(
					'script',
					false,
					workspaceEdit,
					context.vueDocuments,
				)
			}
		}
	}
}
