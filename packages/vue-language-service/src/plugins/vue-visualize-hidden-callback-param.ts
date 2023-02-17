import { LanguageServicePlugin } from '@volar/language-service';
import * as vscode from 'vscode-languageserver-protocol';

const plugin: LanguageServicePlugin = (context) => {

	return {

		inlayHints: {

			async on(document, range) {

				const enabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.inlayHints.eventArgumentInInlineHandlers') ?? true;
				if (!enabled)
					return;

				const result: vscode.InlayHint[] = [];
				const [file] = context.documents.getVirtualFileByUri(document.uri);
				if (file) {
					const start = document.offsetAt(range.start);
					const end = document.offsetAt(range.end);
					for (const mapping of file.mappings) {
						if (
							mapping.generatedRange[0] >= start
							&& mapping.generatedRange[1] <= end
							&& (mapping.data as any).__hiddenParam
						) {
							result.push({
								label: '$event =>',
								paddingRight: true,
								position: document.positionAt(mapping.generatedRange[0]),
								kind: vscode.InlayHintKind.Parameter,
								tooltip: 'Set `"volar.inlayHints.eventArgumentInInlineHandlers": false` to hide Event Argument in Inline Handlers.',
							});
						}
					}
				}
				return result;
			},
		},
	};
};

export default () => plugin;
