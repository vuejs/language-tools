import { LanguageServicePlugin } from '@volar/language-service';
import * as vscode from 'vscode-languageserver-protocol';

const plugin: LanguageServicePlugin = (context) => {

	if (!context)
		return {};

	return {

		async provideInlayHints(document, range) {

			const settings: Record<string, boolean> = {};
			const result: vscode.InlayHint[] = [];
			const [file] = context.documents.getVirtualFileByUri(document.uri);
			if (file) {
				const start = document.offsetAt(range.start);
				const end = document.offsetAt(range.end);
				for (const mapping of file.mappings) {

					const hint: {
						setting: string;
						label: string;
						tooltip: string;
						paddingRight?: boolean;
						paddingLeft?: boolean;
					} | undefined = (mapping.data as any).__hint;

					if (
						mapping.generatedRange[0] >= start
						&& mapping.generatedRange[1] <= end
						&& hint
					) {

						settings[hint.setting] ??= await context.configurationHost?.getConfiguration<boolean>(hint.setting) ?? false;

						if (!settings[hint.setting])
							continue;

						result.push({
							label: hint.label,
							paddingRight: hint.paddingRight,
							paddingLeft: hint.paddingLeft,
							position: document.positionAt(mapping.generatedRange[0]),
							kind: vscode.InlayHintKind.Parameter,
							tooltip: {
								kind: 'markdown',
								value: hint.tooltip,
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
