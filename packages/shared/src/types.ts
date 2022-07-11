import type * as Requests from './requests';

export declare let __requests: typeof Requests; // keep this code for jsdoc link

export interface ServerInitializationOptions {
	typescript: {
		/**
		 * Path to tsserverlibrary.js / tsserver.js / typescript.js
		 * @example
		 * '/usr/local/lib/node_modules/typescript/lib/tsserverlibrary.js' // use global typescript install
		 * 'typescript/lib/tsserverlibrary.js' // if `typescript` exist in `@volar/vue-lannguage-server` itself node_modules directory
		 * '../../../typescript/lib/tsserverlibrary.js' // relative path to @volar/vue-language-server/out/index.js
		 */
		serverPath: string;
		/**
		 * Path to lib/xxx/diagnosticMessages.generated.json
		 * @example
		 * '/usr/local/lib/node_modules/typescript/lib/ja/diagnosticMessages.generated.json' // use global typescript install
		 * 'typescript/lib/ja/diagnosticMessages.generated.json' // if `typescript` exist in `@volar/vue-lannguage-server` itself node_modules directory
		 * '../../../typescript/lib/ja/diagnosticMessages.generated.json' // relative path to @volar/vue-language-server/out/index.js
		 */
		localizedPath?: string;
	};
	/**
	 * typescript, html, css... language service will be create in server if this option is not null
	 */
	languageFeatures?: {
		references?: boolean;
		implementation?: boolean;
		definition?: boolean;
		typeDefinition?: boolean;
		callHierarchy?: boolean;
		hover?: boolean;
		rename?: boolean;
		renameFileRefactoring?: boolean;
		signatureHelp?: boolean;
		completion?: {
			defaultTagNameCase: 'both' | 'kebabCase' | 'pascalCase',
			defaultAttrNameCase: 'kebabCase' | 'camelCase',
			/**
			 * {@link __requests.GetDocumentNameCasesRequest}
			 */
			getDocumentNameCasesRequest?: boolean,
			/**
			 * {@link __requests.GetDocumentSelectionRequest}
			 * */
			getDocumentSelectionRequest?: boolean,
		};
		documentHighlight?: boolean;
		documentLink?: boolean;
		workspaceSymbol?: boolean;
		codeLens?: boolean | {
			/**
			 * {@link __requests.ShowReferencesNotification}
			 * */
			showReferencesNotification?: boolean,
		};
		semanticTokens?: boolean;
		codeAction?: boolean;
		inlayHints?: boolean;
		diagnostics?: boolean | {
			/**
			 * {@link __requests.GetDocumentVersionRequest}
			 * */
			getDocumentVersionRequest: boolean,
		};
		schemaRequestService?: boolean | {
			/**
			 * {@link __requests.GetDocumentContentRequest}
			 * */
			getDocumentContentRequest?: boolean,
		};
	};
	/**
	 * html language service will be create in server if this option is not null
	 */
	documentFeatures?: {
		allowedLanguageIds?: string[];
		selectionRange?: boolean;
		foldingRange?: boolean;
		linkedEditingRange?: boolean;
		documentSymbol?: boolean;
		documentColor?: boolean;
		documentFormatting?: boolean,
	};
}
