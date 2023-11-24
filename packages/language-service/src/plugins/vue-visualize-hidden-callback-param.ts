import { MappingKey, Service } from '@volar/language-service';
import type * as vscode from 'vscode-languageserver-protocol';
import type { VueCodeInformation } from '../types';

const plugin: Service = (context) => {

	if (!context)
		return {};

	return {

		async provideInlayHints(document, range) {

			const settings: Record<string, boolean> = {};
			const result: vscode.InlayHint[] = [];
			const [vitualFile] = context.project.fileProvider.getVirtualFile(document.uri);

			if (vitualFile) {

				const start = document.offsetAt(range.start);
				const end = document.offsetAt(range.end);

				for (const mapping of vitualFile.mappings) {

					const hint = (mapping[MappingKey.DATA] as VueCodeInformation).__hint;

					if (
						mapping[MappingKey.GENERATED_CODE_RANGE][0] >= start
						&& mapping[MappingKey.GENERATED_CODE_RANGE][1] <= end
						&& hint
					) {

						settings[hint.setting] ??= await context.env.getConfiguration?.<boolean>(hint.setting) ?? false;

						if (!settings[hint.setting])
							continue;

						result.push({
							label: hint.label,
							paddingRight: hint.paddingRight,
							paddingLeft: hint.paddingLeft,
							position: document.positionAt(mapping[MappingKey.GENERATED_CODE_RANGE][0]),
							kind: 2 satisfies typeof vscode.InlayHintKind.Parameter,
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

export const create = () => plugin;
