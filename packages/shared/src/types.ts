import type {
	GetDocumentNameCasesRequest,
	GetDocumentSelectionRequest,
	ShowReferencesNotification,
	GetDocumentVersionRequest,
	GetDocumentContentRequest,
} from './requests';

export interface ServerInitializationOptions {
	typescript: {
		/**
		 * Path of tsserverlibrary.js / tsserver.js / typescript.js
		 */
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
		completion?: {
			defaultTagNameCase: 'both' | 'kebabCase' | 'pascalCase',
			defaultAttrNameCase: 'kebabCase' | 'pascalCase',
			/**
			 * {@link GetDocumentNameCasesRequest}
			 */
			getDocumentNameCasesRequest?: boolean,
			/**
			 * {@link GetDocumentSelectionRequest}
			 * */
			getDocumentSelectionRequest?: boolean,
		}
		documentHighlight?: boolean
		documentSymbol?: boolean
		documentLink?: boolean
		documentColor?: boolean
		codeLens?: boolean | {
			/**
			 * {@link ShowReferencesNotification}
			 * */
			showReferencesNotification?: boolean,
		}
		semanticTokens?: boolean
		codeAction?: boolean
		diagnostics?: boolean | {
			/**
			 * {@link GetDocumentVersionRequest}
			 * */
			getDocumentVersionRequest: boolean,
		}
		schemaRequestService?: boolean | {
			/**
			 * {@link GetDocumentContentRequest}
			 * */
			getDocumentContentRequest?: boolean,
		}
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
