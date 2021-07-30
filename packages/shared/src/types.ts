export interface ServerInitializationOptions {
	typescript: {
		serverPath: string
		localizedPath: string | undefined
	}
	/**
	 * typescript, html, css... language service will be create in server if this option is not null
	 */
	features?: {
		references?: boolean | { enabledInTsScript: boolean }
		definition?: boolean | { enabledInTsScript: boolean }
		typeDefinition?: boolean | { enabledInTsScript: boolean }
		callHierarchy?: boolean | { enabledInTsScript: boolean }
		hover?: boolean
		rename?: boolean
		renameFileRefactoring?: boolean
		selectionRange?: boolean
		signatureHelp?: boolean
		completion?: boolean
		documentHighlight?: boolean
		documentSymbol?: boolean
		documentLink?: boolean
		documentColor?: boolean
		codeLens?: boolean
		semanticTokens?: boolean
		codeAction?: boolean
		diagnostics?: boolean
	}
	/**
	 * html language service will be create in server if this option is not null
	 */
	htmlFeatures?: {
		foldingRange?: boolean
		linkedEditingRange?: boolean
		documentFormatting?: boolean
	}
}
