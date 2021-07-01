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
import { uriToFsPath } from '@volar/shared';
import * as path from 'upath';

export interface Data {
	fileName: string,
	offset: number,
	source: string | undefined,
	name: string,
	options: ts.GetCompletionsAtPositionOptions | undefined,
	tsData: any,
}

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, rootDir: string) {
	return (uri: string, position: Position, options?: ts.GetCompletionsAtPositionOptions): CompletionItem[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const _options: ts.GetCompletionsAtPositionOptions = {
			includeCompletionsWithInsertText: true,
			...options,
		};

		const info = languageService.getCompletionsAtPosition(fileName, offset, _options);
		if (info === undefined) return [];

		const wordRange2 = info.optionalReplacementSpan ? {
			start: info.optionalReplacementSpan.start,
			end: info.optionalReplacementSpan.start + info.optionalReplacementSpan.length,
		} : undefined;
		const wordRange = wordRange2 ? Range.create(
			document.positionAt(wordRange2.start),
			document.positionAt(wordRange2.end),
		) : undefined;

		const entries = info.entries
			.map(entry => {
				const data: Data = {
					fileName,
					offset,
					source: entry.source,
					name: entry.name,
					options: _options,
					tsData: entry.data,
				};
				let item: CompletionItem = {
					label: entry.name,
					labelDetails: {
						qualifier: entry.source && path.isAbsolute(entry.source) ? path.relative(rootDir, entry.source) : entry.source,
					},
					kind: convertKind(entry.kind),
					sortText: entry.sortText,
					insertText: entry.insertText,
					preselect: entry.isRecommended,
					commitCharacters: getCommitCharacters(entry, info.isNewIdentifierLocation),
					data,
				}

				handleKindModifiers(item, entry);
				item = fuzzyCompletionItem(info, document, entry, item);

				return item;
			});
		return entries;

		// from vscode typescript
		function fuzzyCompletionItem(info: ts.CompletionInfo, document: TextDocument, entry: ts.CompletionEntry, item: CompletionItem) {
			if (info.isNewIdentifierLocation && entry.replacementSpan) {
				const replaceRange = Range.create(
					document.positionAt(entry.replacementSpan.start),
					document.positionAt(entry.replacementSpan.start + entry.replacementSpan.length),
				);
				item.textEdit = TextEdit.replace(replaceRange, item.insertText ?? item.label);
			}
			else {
				if (entry.replacementSpan) {
					/**
					 * @before
					 * foo. + ['a/b/c'] => foo.['a/b/c']
					 * @after
					 * foo. + ['a/b/c'] => foo['a/b/c']
					 */
					const replaceRange = !wordRange2
						? Range.create(
							document.positionAt(entry.replacementSpan.start),
							document.positionAt(entry.replacementSpan.start + entry.replacementSpan.length),
						)
						: entry.replacementSpan.start <= wordRange2.start
							? Range.create(
								document.positionAt(entry.replacementSpan.start),
								document.positionAt(Math.min(entry.replacementSpan.start + entry.replacementSpan.length, wordRange2.start)),
							)
							: Range.create(
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
		function getCommitCharacters(entry: ts.CompletionEntry, isNewIdentifierLocation: boolean): string[] | undefined {
			if (isNewIdentifierLocation) {
				return undefined;
			}

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

export function handleKindModifiers(item: CompletionItem, entry: ts.CompletionEntry | ts.CompletionEntryDetails) {
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
}
