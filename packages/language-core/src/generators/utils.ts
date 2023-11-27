import { VueCodeInformation } from '../types';

export function disableAllFeatures(override: VueCodeInformation): VueCodeInformation {
	return {
		diagnostics: false,
		renameEdits: false,
		formattingEdits: false,
		completionItems: false,
		definitions: false,
		references: false,
		foldingRanges: false,
		inlayHints: false,
		codeActions: false,
		symbols: false,
		selectionRanges: false,
		linkedEditingRanges: false,
		colors: false,
		autoInserts: false,
		codeLenses: false,
		highlights: false,
		links: false,
		semanticTokens: false,
		hover: false,
		signatureHelps: false,
		...override,
	};
}

export function enableAllFeatures(override: VueCodeInformation): VueCodeInformation {
	return {
		diagnostics: true,
		renameEdits: true,
		formattingEdits: true,
		completionItems: true,
		definitions: true,
		references: true,
		foldingRanges: true,
		inlayHints: true,
		codeActions: true,
		symbols: true,
		selectionRanges: true,
		linkedEditingRanges: true,
		colors: true,
		autoInserts: true,
		codeLenses: true,
		highlights: true,
		links: true,
		semanticTokens: true,
		hover: true,
		signatureHelps: true,
		...override,
	};
}

export function mergeFeatureSettings(...infos: VueCodeInformation[]): VueCodeInformation {
	const result: VueCodeInformation = { ...infos[0] };
	for (const info of infos) {
		for (const key in info) {
			const value = info[key as keyof VueCodeInformation];
			if (value) {
				result[key as keyof VueCodeInformation] = value as any;
			}
		}
	}
	return result;
}
