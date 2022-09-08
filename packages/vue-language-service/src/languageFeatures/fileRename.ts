import type { LanguageServiceRuntimeContext } from '../types';
import { embeddedEditToSourceEdit } from './rename';
import type * as _ from 'vscode-languageserver-protocol';
import * as dedupe from '../utils/dedupe';

export function register(context: LanguageServiceRuntimeContext) {

	return async (oldUri: string, newUri: string) => {

		const vueDocument = context.vueDocuments.get(oldUri);

		if (vueDocument) {
			oldUri += '.ts';
			newUri += '.ts';
		}

		for (const plugin of context.plugins) {

			if (!plugin.doFileRename)
				continue;

			const workspaceEdit = await plugin.doFileRename(oldUri, newUri);

			if (workspaceEdit) {

				const result = embeddedEditToSourceEdit(
					workspaceEdit,
					context.vueDocuments,
				);

				if (result?.documentChanges) {
					result.documentChanges = dedupe.withDocumentChanges(result.documentChanges);
				}

				return result;
			}
		}
	};
}
