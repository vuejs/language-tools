export interface TsMappingData {
	vueTag: 'sfc' | 'template' | 'script' | 'scriptSetup' | 'scriptSrc' | 'style',
	vueTagIndex?: number,
	beforeRename?: (newName: string) => string,
	doRename?: (oldName: string, newName: string) => string,
	capabilities: {
		basic?: boolean,
		references?: boolean,
		definitions?: boolean,
		diagnostic?: boolean,
		formatting?: boolean,
		rename?: boolean | {
			in: boolean,
			out: boolean,
		},
		completion?: boolean,
		semanticTokens?: boolean,
		foldingRanges?: boolean,
		referencesCodeLens?: boolean,
		displayWithLink?: boolean,
	},
}

export interface TeleportSideData {
	editRenameText?: (newName: string) => string,
	capabilities: {
		references?: boolean,
		definitions?: boolean,
		rename?: boolean,
	},
}

export interface TeleportMappingData {
	isAdditionalReference?: boolean;
	toSource: TeleportSideData,
	toTarget: TeleportSideData,
}

export interface TextRange {
	start: number,
	end: number,
}
