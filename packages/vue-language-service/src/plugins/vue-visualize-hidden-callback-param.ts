import { LanguageServicePlugin } from '@volar/language-service';
import * as vscode from 'vscode-languageserver-protocol';

const plugin: LanguageServicePlugin = (context) => {

	if (!context)
		return {};

	return {

		async provideInlayHints(document, range) {

			const enabled = await context.configurationHost?.getConfiguration<boolean>('vue.features.inlayHints.inlineHandlerLeading') ?? false;
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
							tooltip: {
								kind: 'markdown',
								value: [
									'`$event` is a hidden parameter, you can use it in this callback.',
									'To hide this hint, set `vue.features.inlayHints.inlineHandlerLeading` to `false` in IDE settings.',
									'[More info](https://github.com/vuejs/language-tools/issues/2445#issuecomment-1444771420)',
								].join('\n\n'),
							},
						});
					}
				}
			}
			return result;
		},
	};
};

export default () => plugin;
