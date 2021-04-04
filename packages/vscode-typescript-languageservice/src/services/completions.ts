import type * as ts from 'typescript';
import * as PConst from '../protocol.const';
import {
	Position,
	CompletionItem,
	CompletionItemKind,
	Range,
	TextEdit,
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, getWordStart, fsPathToUri } from '@volar/shared';
import * as path from 'upath';

export const wordPatterns: { [lang: string]: RegExp } = {
	javascript: /(-?\d*\.\d\w*)|([^\`\~\!\@\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
	typescript: /(-?\d*\.\d\w*)|([^\`\~\!\@\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
	javascriptreact: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
	typescriptreact: /(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
};

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, rootDir: string) {
	return (uri: string, position: Position, options?: ts.GetCompletionsAtPositionOptions): CompletionItem[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		// TODO: use vscode config, check: https://github.com/microsoft/vscode/blob/a699ffaee62010c4634d301da2bbdb7646b8d1da/extensions/typescript-language-features/src/languageFeatures/fileConfigurationManager.ts#L163
		const defaultOptions: ts.GetCompletionsAtPositionOptions = {
			disableSuggestions: false,
			// includeCompletionsForModuleExports: true,
			includeAutomaticOptionalChainCompletions: true,
			includeCompletionsWithInsertText: true,
			importModuleSpecifierPreference: 'shortest',
			// importModuleSpecifierEnding: 'minimal' | 'index' | 'js',
			allowTextChangesInNewFiles: true,
			providePrefixAndSuffixTextForRename: true,
		};
		const _options = {
			...defaultOptions,
			...options,
		};

		const completions = languageService.getCompletionsAtPosition(fileName, offset, _options);
		if (completions === undefined) return [];

		const wordPattern = wordPatterns[document.languageId] ?? wordPatterns.javascript;
		const wordStart = getWordStart(wordPattern, position, document);
		const wordRange = wordStart ? { start: wordStart, end: position } : undefined;
		const wordRange2 = wordRange ? { start: document.offsetAt(wordRange.start), end: document.offsetAt(wordRange.end) } : undefined;

		const entries = completions.entries
			.map(entry => {
				let item: CompletionItem = {
					label: entry.name,
					labelDetails: {
						qualifier: entry.source && path.isAbsolute(entry.source) ? path.relative(rootDir, entry.source) : undefined,
					},
					kind: convertKind(entry.kind),
					sortText: entry.sortText,
					insertText: entry.insertText,
					preselect: entry.isRecommended,
					commitCharacters: getCommitCharacters(entry),
					data: {
						fileName,
						offset,
						source: entry.source,
						name: entry.name,
						options: _options,
					},
				}

				item = fuzzyCompletionItem(document, entry, item);

				return item;
			});
		return entries;

		// from vscode typescript
		function fuzzyCompletionItem(document: TextDocument, entry: ts.CompletionEntry, item: CompletionItem) {
			if (entry.kindModifiers) {
				const kindModifiers = entry.kindModifiers.split(/,|\s+/g);
				if (kindModifiers.includes(PConst.KindModifiers.optional)) {
					if (!item.insertText) {
						item.insertText = item.label;
					}

					if (!item.filterText) {
						item.filterText = item.label;
					}
					item.label += '?';
				}

				if (kindModifiers.includes(PConst.KindModifiers.color)) {
					item.kind = CompletionItemKind.Color;
				}

				if (entry.kind === PConst.Kind.script) {
					for (const extModifier of PConst.KindModifiers.fileExtensionKindModifiers) {
						if (kindModifiers.includes(extModifier)) {
							if (entry.name.toLowerCase().endsWith(extModifier)) {
								item.detail = entry.name;
							} else {
								item.detail = entry.name + extModifier;
							}
							break;
						}
					}
				}
			}

			if (entry.replacementSpan) {
				/**
				 * @before
				 * foo. + ['a/b/c'] => foo.['a/b/c']
				 * @after
				 * foo. + ['a/b/c'] => foo['a/b/c']
				 */
				const replaceRange = !wordRange2 ? Range.create(
					document.positionAt(entry.replacementSpan.start),
					document.positionAt(entry.replacementSpan.start + entry.replacementSpan.length),
				) : entry.replacementSpan.start <= wordRange2.start ? Range.create(
					document.positionAt(entry.replacementSpan.start),
					document.positionAt(Math.min(entry.replacementSpan.start + entry.replacementSpan.length, wordRange2.start)),
				) : Range.create(
					document.positionAt(Math.max(entry.replacementSpan.start, wordRange2.end)),
					document.positionAt(entry.replacementSpan.start + entry.replacementSpan.length),
				);
				item.additionalTextEdits = [TextEdit.del(replaceRange)];
			}
			if (wordRange) {
				/**
				 * @before
				 * $f + $foo => $$foo
				 * @after
				 * $f + $foo => $foo
				 */
				item.textEdit = TextEdit.replace(wordRange, item.insertText ?? item.label);
			}

			return item;
		}
		function convertKind(kind: string): CompletionItemKind {
			switch (kind) {
				case PConst.Kind.primitiveType:
				case PConst.Kind.keyword:
					return CompletionItemKind.Keyword;

				case PConst.Kind.const:
				case PConst.Kind.let:
				case PConst.Kind.variable:
				case PConst.Kind.localVariable:
				case PConst.Kind.alias:
				case PConst.Kind.parameter:
					return CompletionItemKind.Variable;

				case PConst.Kind.memberVariable:
				case PConst.Kind.memberGetAccessor:
				case PConst.Kind.memberSetAccessor:
					return CompletionItemKind.Field;

				case PConst.Kind.function:
				case PConst.Kind.localFunction:
					return CompletionItemKind.Function;

				case PConst.Kind.method:
				case PConst.Kind.constructSignature:
				case PConst.Kind.callSignature:
				case PConst.Kind.indexSignature:
					return CompletionItemKind.Method;

				case PConst.Kind.enum:
					return CompletionItemKind.Enum;

				case PConst.Kind.enumMember:
					return CompletionItemKind.EnumMember;

				case PConst.Kind.module:
				case PConst.Kind.externalModuleName:
					return CompletionItemKind.Module;

				case PConst.Kind.class:
				case PConst.Kind.type:
					return CompletionItemKind.Class;

				case PConst.Kind.interface:
					return CompletionItemKind.Interface;

				case PConst.Kind.warning:
					return CompletionItemKind.Text;

				case PConst.Kind.script:
					return CompletionItemKind.File;

				case PConst.Kind.directory:
					return CompletionItemKind.Folder;

				case PConst.Kind.string:
					return CompletionItemKind.Constant;

				default:
					return CompletionItemKind.Property;
			}
		}
		function getCommitCharacters(entry: ts.CompletionEntry): string[] | undefined {
			const commitCharacters: string[] = [];
			switch (entry.kind) {
				case PConst.Kind.memberGetAccessor:
				case PConst.Kind.memberSetAccessor:
				case PConst.Kind.constructSignature:
				case PConst.Kind.callSignature:
				case PConst.Kind.indexSignature:
				case PConst.Kind.enum:
				case PConst.Kind.interface:
					commitCharacters.push('.', ';');
					break;

				case PConst.Kind.module:
				case PConst.Kind.alias:
				case PConst.Kind.const:
				case PConst.Kind.let:
				case PConst.Kind.variable:
				case PConst.Kind.localVariable:
				case PConst.Kind.memberVariable:
				case PConst.Kind.class:
				case PConst.Kind.function:
				case PConst.Kind.method:
				case PConst.Kind.keyword:
				case PConst.Kind.parameter:
					commitCharacters.push('.', ',', ';');
					// if (context.enableCallCompletions) {
					commitCharacters.push('(');
					// }
					break;
			}
			return commitCharacters.length === 0 ? undefined : commitCharacters;
		}
	}
}
