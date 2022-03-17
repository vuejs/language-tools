export interface EmbeddedFileMappingData {
	vueTag: 'sfc' | 'template' | 'script' | 'scriptSetup' | 'scriptSrc' | 'style' | 'customBlock' | undefined,
	vueTagIndex?: number,
	normalizeNewName?: (newName: string) => string,
	applyNewName?: (oldName: string, newName: string) => string,
	capabilities: {
		basic?: boolean,
		references?: boolean,
		definitions?: boolean,
		diagnostic?: boolean,
		rename?: boolean | {
			in: boolean,
			out: boolean,
		},
		completion?: boolean,
		semanticTokens?: boolean,
		referencesCodeLens?: boolean,
		displayWithLink?: boolean,
	},
}

export interface TeleportSideData {
	transformNewName?: (newName: string) => string,
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
