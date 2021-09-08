import type * as ts from 'typescript/lib/tsserverlibrary';
import * as PConst from '../protocol.const';
import * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';

export interface Data {
	uri: string,
	fileName: string,
	offset: number,
	source: string | undefined,
	name: string,
	tsData: any,
}

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	return (uri: string, position: vscode.Position, options?: ts.GetCompletionsAtPositionOptions): vscode.CompletionItem[] => {

		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const _options: ts.GetCompletionsAtPositionOptions = {
			includeCompletionsWithInsertText: true, // TODO: ?
			...options,
		};

		const info = languageService.getCompletionsAtPosition(fileName, offset, _options);
		if (info === undefined) return [];

		const wordRange2 = info.optionalReplacementSpan ? {
			start: info.optionalReplacementSpan.start,
			end: info.optionalReplacementSpan.start + info.optionalReplacementSpan.length,
		} : undefined;
		const wordRange = wordRange2 ? vscode.Range.create(
			document.positionAt(wordRange2.start),
			document.positionAt(wordRange2.end),
		) : undefined;

		const entries = info.entries
			.map(entry => {
				const data: Data = {
					uri,
					fileName,
					offset,
					source: entry.source,
					name: entry.name,
					tsData: entry.data,
				};
				let item: vscode.CompletionItem = {
					label: entry.name,
					labelDetails: {
						description: ts.displayPartsToString(entry.sourceDisplay),
					},
					kind: convertKind(entry.kind),
					sortText: entry.sortText,
					insertText: entry.insertText,
					insertTextFormat: entry.isSnippet ? vscode.InsertTextFormat.Snippet : vscode.InsertTextFormat.PlainText,
					preselect: entry.isRecommended,
					commitCharacters: getCommitCharacters(entry, info.isNewIdentifierLocation),
					data,
				};

				handleKindModifiers(item, entry);
				item = fuzzyCompletionItem(info, document, entry, item);

				return item;
			});

		return entries;

		// from vscode typescript
		function fuzzyCompletionItem(info: ts.CompletionInfo, document: TextDocument, entry: ts.CompletionEntry, item: vscode.CompletionItem) {
			if (info.isNewIdentifierLocation && entry.replacementSpan) {
				const replaceRange = vscode.Range.create(
					document.positionAt(entry.replacementSpan.start),
					document.positionAt(entry.replacementSpan.start + entry.replacementSpan.length),
				);
				item.textEdit = vscode.TextEdit.replace(replaceRange, item.insertText ?? item.label);
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
						? vscode.Range.create(
							document.positionAt(entry.replacementSpan.start),
							document.positionAt(entry.replacementSpan.start + entry.replacementSpan.length),
						)
						: entry.replacementSpan.start <= wordRange2.start
							? vscode.Range.create(
								document.positionAt(entry.replacementSpan.start),
								document.positionAt(Math.min(entry.replacementSpan.start + entry.replacementSpan.length, wordRange2.start)),
							)
							: vscode.Range.create(
								document.positionAt(Math.max(entry.replacementSpan.start, wordRange2.end)),
								document.positionAt(entry.replacementSpan.start + entry.replacementSpan.length),
							);
					item.additionalTextEdits = [vscode.TextEdit.del(replaceRange)];
				}
				if (wordRange) {
					/**
					 * @before
					 * $f + $foo => $$foo
					 * @after
					 * $f + $foo => $foo
					 */
					item.textEdit = vscode.TextEdit.replace(wordRange, item.insertText ?? item.label);
				}
			}

			return item;
		}
		function convertKind(kind: string): vscode.CompletionItemKind {
			switch (kind) {
				case PConst.Kind.primitiveType:
				case PConst.Kind.keyword:
					return vscode.CompletionItemKind.Keyword;

				case PConst.Kind.const:
				case PConst.Kind.let:
				case PConst.Kind.variable:
				case PConst.Kind.localVariable:
				case PConst.Kind.alias:
				case PConst.Kind.parameter:
					return vscode.CompletionItemKind.Variable;

				case PConst.Kind.memberVariable:
				case PConst.Kind.memberGetAccessor:
				case PConst.Kind.memberSetAccessor:
					return vscode.CompletionItemKind.Field;

				case PConst.Kind.function:
				case PConst.Kind.localFunction:
					return vscode.CompletionItemKind.Function;

				case PConst.Kind.method:
				case PConst.Kind.constructSignature:
				case PConst.Kind.callSignature:
				case PConst.Kind.indexSignature:
					return vscode.CompletionItemKind.Method;

				case PConst.Kind.enum:
					return vscode.CompletionItemKind.Enum;

				case PConst.Kind.enumMember:
					return vscode.CompletionItemKind.EnumMember;

				case PConst.Kind.module:
				case PConst.Kind.externalModuleName:
					return vscode.CompletionItemKind.Module;

				case PConst.Kind.class:
				case PConst.Kind.type:
					return vscode.CompletionItemKind.Class;

				case PConst.Kind.interface:
					return vscode.CompletionItemKind.Interface;

				case PConst.Kind.warning:
					return vscode.CompletionItemKind.Text;

				case PConst.Kind.script:
					return vscode.CompletionItemKind.File;

				case PConst.Kind.directory:
					return vscode.CompletionItemKind.Folder;

				case PConst.Kind.string:
					return vscode.CompletionItemKind.Constant;

				default:
					return vscode.CompletionItemKind.Property;
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

export function handleKindModifiers(item: vscode.CompletionItem, entry: ts.CompletionEntry | ts.CompletionEntryDetails) {
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
			item.kind = vscode.CompletionItemKind.Color;
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
