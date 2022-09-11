import { EmbeddedLanguageServicePlugin, useConfigurationHost, useRootUri, useTypeScriptLanguageService, useTypeScriptLanguageServiceHost, useTypeScriptModule } from '@volar/language-service';
import * as ts2 from '@volar/typescript-language-service';
import * as semver from 'semver';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

export { getSemanticTokenLegend } from '@volar/typescript-language-service';

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

export default function (): EmbeddedLanguageServicePlugin & {
	languageService: ts2.LanguageService,
} {

	const ts = useTypeScriptModule();
	const tsLs = useTypeScriptLanguageService();
	const tsLsHost = useTypeScriptLanguageServiceHost();
	const configHost = useConfigurationHost();
	const rootUri = useRootUri();

	const basicTriggerCharacters = getBasicTriggerCharacters(ts.version);
	const tsLs2 = ts2.createLanguageService(
		ts,
		tsLsHost,
		tsLs,
		(section, scopeUri) => configHost?.getConfiguration(section, scopeUri) as any,
		rootUri,
	);

	return {

		languageService: tsLs2,

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

						const completeOptions: ts.GetCompletionsAtPositionOptions = {
							triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
							triggerKind: context?.triggerKind,
						};
						const basicResult = await tsLs2.doComplete(document.uri, position, completeOptions);

						if (basicResult) {
							result = basicResult;
						}
					}
					if (!context || context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter || (context.triggerCharacter && jsDocTriggerCharacters.includes(context.triggerCharacter))) {

						const jsdocResult = await tsLs2.doJsDocComplete(document.uri, position);

						if (jsdocResult) {
							result.items.push(jsdocResult);
						}
					}
					if (!context || context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter || (context.triggerCharacter && directiveCommentTriggerCharacters.includes(context.triggerCharacter))) {

						const directiveCommentResult = await tsLs2.doDirectiveCommentComplete(document.uri, position);

						if (directiveCommentResult) {
							result.items = result.items.concat(directiveCommentResult);
						}
					}

					return result;
				}
			},

			resolve(item) {
				return tsLs2.doCompletionResolve(item);
			},
		},

		rename: {

			prepare(document, position) {
				if (isTsDocument(document)) {
					return tsLs2.prepareRename(document.uri, position);
				}
			},

			on(document, position, newName) {
				if (isTsDocument(document) || isJsonDocument(document)) {
					return tsLs2.doRename(document.uri, position, newName);
				}
			},
		},

		codeAction: {

			on(document, range, context) {
				if (isTsDocument(document)) {
					return tsLs2.getCodeActions(document.uri, range, context);
				}
			},

			resolve(codeAction) {
				return tsLs2.doCodeActionResolve(codeAction);
			},
		},

		inlayHints: {

			on(document, range) {
				if (isTsDocument(document)) {
					return tsLs2.getInlayHints(document.uri, range);
				}
			},
		},

		callHierarchy: {

			prepare(document, position) {
				if (isTsDocument(document)) {
					return tsLs2.callHierarchy.doPrepare(document.uri, position);
				}
			},

			onIncomingCalls(item) {
				return tsLs2.callHierarchy.getIncomingCalls(item);
			},

			onOutgoingCalls(item) {
				return tsLs2.callHierarchy.getOutgoingCalls(item);
			},
		},

		definition: {

			on(document, position) {
				if (isTsDocument(document)) {
					return tsLs2.findDefinition(document.uri, position);
				}
			},

			onType(document, position) {
				if (isTsDocument(document)) {
					return tsLs2.findTypeDefinition(document.uri, position);
				}
			},
		},

		validation: {
			onSemantic(document) {
				if (isTsDocument(document)) {
					return tsLs2.doValidation(document.uri, { semantic: true });
				}
			},
			onDeclaration(document) {
				if (isTsDocument(document)) {
					return tsLs2.doValidation(document.uri, { declaration: true });
				}
			},
			onSuggestion(document) {
				if (isTsDocument(document)) {
					return tsLs2.doValidation(document.uri, { suggestion: true });
				}
			},
			onSyntactic(document) {
				if (isTsDocument(document)) {
					return tsLs2.doValidation(document.uri, { syntactic: true });
				}
			},
		},

		doHover(document, position) {
			if (isTsDocument(document)) {
				return tsLs2.doHover(document.uri, position);
			}
		},

		findImplementations(document, position) {
			if (isTsDocument(document)) {
				return tsLs2.findImplementations(document.uri, position);
			}
		},

		findReferences(document, position) {
			if (isTsDocument(document) || isJsonDocument(document)) {
				return tsLs2.findReferences(document.uri, position);
			}
		},

		findFileReferences(document) {
			if (isTsDocument(document) || isJsonDocument(document)) {
				return tsLs2.findFileReferences(document.uri);
			}
		},

		findDocumentHighlights(document, position) {
			if (isTsDocument(document)) {
				return tsLs2.findDocumentHighlights(document.uri, position);
			}
		},

		findDocumentSymbols(document) {
			if (isTsDocument(document)) {
				return tsLs2.findDocumentSymbols(document.uri);
			}
		},

		findDocumentSemanticTokens(document, range, cancleToken) {
			if (isTsDocument(document)) {
				return tsLs2.getDocumentSemanticTokens(document.uri, range, cancleToken);
			}
		},

		findWorkspaceSymbols(query) {
			return tsLs2.findWorkspaceSymbols(query);
		},

		doFileRename(oldUri, newUri) {
			return tsLs2.getEditsForFileRename(oldUri, newUri);
		},

		getFoldingRanges(document) {
			if (isTsDocument(document)) {
				return tsLs2.getFoldingRanges(document.uri);
			}
		},

		getSelectionRanges(document, positions) {
			if (isTsDocument(document)) {
				return tsLs2.getSelectionRanges(document.uri, positions);
			}
		},

		getSignatureHelp(document, position, context) {
			if (isTsDocument(document)) {
				return tsLs2.getSignatureHelp(document.uri, position, context);
			}
		},

		async format(document, range, options_2) {
			if (isTsDocument(document)) {

				const enable = await useConfigurationHost()?.getConfiguration<boolean>(getConfigTitle(document) + '.format.enable', document.uri);

				if (enable === false) {
					return;
				}

				return tsLs2.doFormatting.onRange(document.uri, options_2, range);
			}
		},

		async formatOnType(document, position, key, options_2) {
			if (isTsDocument(document)) {

				const enable = await useConfigurationHost()?.getConfiguration<boolean>(getConfigTitle(document) + '.format.enable', document.uri);

				if (enable === false) {
					return;
				}

				return tsLs2.doFormatting.onType(document.uri, options_2, position, key);
			}
		},
	};
}

function getConfigTitle(document: TextDocument) {
	if (document.languageId === 'javascriptreact') {
		return 'javascript';
	}
	if (document.languageId === 'typescriptreact') {
		return 'typescript';
	}
	return document.languageId;
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
