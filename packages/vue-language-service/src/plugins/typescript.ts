import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as ts2 from '@volar/typescript-language-service';
import * as semver from 'semver';
import * as vscode from 'vscode-languageserver-protocol';

function getBasicTriggerCharacters(tsVersion: string) {

	const triggerCharacters = ['.', '"', '\'', '`', '/', '<'];

	// https://github.com/microsoft/vscode/blob/8e65ae28d5fb8b3c931135da1a41edb9c80ae46f/extensions/typescript-language-features/src/languageFeatures/completions.ts#L811-L833
	if (semver.lt(tsVersion, '3.1.0') || semver.gte(tsVersion, '3.2.0')) {
		triggerCharacters.push('@');
	}
	if (semver.gte(tsVersion, '3.8.1')) {
		triggerCharacters.push('#');
	}
	if (semver.gte(tsVersion, '4.3.0')) {
		triggerCharacters.push(' ');
	}

	return triggerCharacters;
}

const jsDocTriggerCharacters = ['*'];
const directiveCommentTriggerCharacters = ['@'];

export default function (options: {
	tsVersion: string,
	getTsLs: () => ts2.LanguageService,
	getBaseCompletionOptions?: (uri: string) => ts.GetCompletionsAtPositionOptions,
}): EmbeddedLanguageServicePlugin {

	const basicTriggerCharacters = getBasicTriggerCharacters(options.tsVersion);

	return {

		complete: {

			triggerCharacters: [
				...basicTriggerCharacters,
				...jsDocTriggerCharacters,
				...directiveCommentTriggerCharacters,
			],

			async on(document, position, context) {
				if (isTsDocument(document)) {

					let result: vscode.CompletionList = {
						isIncomplete: false,
						items: [],
					};

					if (!context || context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter || (context.triggerCharacter && basicTriggerCharacters.includes(context.triggerCharacter))) {

						const baseCompletionOptions = options.getBaseCompletionOptions?.(document.uri) ?? [];
						const completeOptions: ts.GetCompletionsAtPositionOptions = {
							...baseCompletionOptions,
							triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
							triggerKind: context?.triggerKind,
						};
						const basicResult = await options.getTsLs().doComplete(document.uri, position, completeOptions);

						if (basicResult) {
							result = basicResult;
						}
					}
					if (!context || context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter || (context.triggerCharacter && jsDocTriggerCharacters.includes(context.triggerCharacter))) {

						const jsdocResult = await options.getTsLs().doJsDocComplete(document.uri, position);

						if (jsdocResult) {
							result.items.push(jsdocResult);
						}
					}
					if (!context || context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter || (context.triggerCharacter && directiveCommentTriggerCharacters.includes(context.triggerCharacter))) {

						const directiveCommentResult = await options.getTsLs().doDirectiveCommentComplete(document.uri, position);

						if (directiveCommentResult) {
							result.items = result.items.concat(directiveCommentResult);
						}
					}

					return result;
				}
			},

			resolve(item) {
				return options.getTsLs().doCompletionResolve(item);
			},
		},

		rename: {

			prepare(document, position) {
				if (isTsDocument(document)) {
					return options.getTsLs().prepareRename(document.uri, position);
				}
			},

			on(document, position, newName) {
				if (isTsDocument(document) || isJsonDocument(document)) {
					return options.getTsLs().doRename(document.uri, position, newName);
				}
			},
		},

		codeAction: {

			on(document, range, context) {
				if (isTsDocument(document)) {
					return options.getTsLs().getCodeActions(document.uri, range, context);
				}
			},

			resolve(codeAction) {
				return options.getTsLs().doCodeActionResolve(codeAction);
			},
		},

		inlayHints: {

			on(document, range) {
				if (isTsDocument(document)) {
					return options.getTsLs().getInlayHints(document.uri, range);
				}
			},
		},

		callHierarchy: {

			prepare(document, position) {
				if (isTsDocument(document)) {
					return options.getTsLs().callHierarchy.doPrepare(document.uri, position);
				}
			},

			onIncomingCalls(item) {
				return options.getTsLs().callHierarchy.getIncomingCalls(item);
			},

			onOutgoingCalls(item) {
				return options.getTsLs().callHierarchy.getOutgoingCalls(item);
			},
		},

		definition: {

			on(document, position) {
				if (isTsDocument(document)) {
					return options.getTsLs().findDefinition(document.uri, position);
				}
			},

			onType(document, position) {
				if (isTsDocument(document)) {
					return options.getTsLs().findTypeDefinition(document.uri, position);
				}
			},
		},

		doValidation(document, options_2) {
			if (isTsDocument(document)) {
				return options.getTsLs().doValidation(document.uri, options_2);
			}
		},

		doHover(document, position) {
			if (isTsDocument(document)) {
				return options.getTsLs().doHover(document.uri, position);
			}
		},

		findImplementations(document, position) {
			if (isTsDocument(document)) {
				return options.getTsLs().findImplementations(document.uri, position);
			}
		},

		findReferences(document, position) {
			if (isTsDocument(document) || isJsonDocument(document)) {
				return options.getTsLs().findReferences(document.uri, position);
			}
		},

		findDocumentHighlights(document, position) {
			if (isTsDocument(document)) {
				return options.getTsLs().findDocumentHighlights(document.uri, position);
			}
		},

		findDocumentSymbols(document) {
			if (isTsDocument(document)) {
				return options.getTsLs().findDocumentSymbols(document.uri);
			}
		},

		findDocumentSemanticTokens(document, range, cancleToken) {
			if (isTsDocument(document)) {
				return options.getTsLs().getDocumentSemanticTokens(document.uri, range, cancleToken);
			}
		},

		findWorkspaceSymbols(query) {
			return options.getTsLs().findWorkspaceSymbols(query);
		},

		doFileRename(oldUri, newUri) {
			return options.getTsLs().getEditsForFileRename(oldUri, newUri);
		},

		getFoldingRanges(document) {
			if (isTsDocument(document)) {
				return options.getTsLs().getFoldingRanges(document.uri);
			}
		},

		getSelectionRanges(document, positions) {
			if (isTsDocument(document)) {
				return options.getTsLs().getSelectionRanges(document.uri, positions);
			}
		},

		getSignatureHelp(document, position, context) {
			if (isTsDocument(document)) {
				return options.getTsLs().getSignatureHelp(document.uri, position, context);
			}
		},

		format(document, range, options_2) {
			if (isTsDocument(document)) {
				return options.getTsLs().doFormatting.onRange(document.uri, options_2, range);
			}
		},

		formatOnType(document, position, key, options_2) {
			if (isTsDocument(document)) {
				return options.getTsLs().doFormatting.onType(document.uri, options_2, position, key);
			}
		},
	};
}

export function isTsDocument(document: TextDocument) {
	return document.languageId === 'javascript' ||
		document.languageId === 'typescript' ||
		document.languageId === 'javascriptreact' ||
		document.languageId === 'typescriptreact';
}

export function isJsonDocument(document: TextDocument) {
	return document.languageId === 'json' ||
		document.languageId === 'jsonc';
}
