import type * as ts from 'typescript/lib/tsserverlibrary';
import * as PConst from '../protocol.const';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import * as semver from 'semver';
import { parseKindModifier } from '../utils/modifiers';

export interface Data {
	uri: string,
	fileName: string,
	offset: number,
	source: string | undefined,
	name: string,
	tsData: any,
}

export function getTriggerCharacters(tsVersion: string) {

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

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	return (uri: string, position: vscode.Position, options?: ts.GetCompletionsAtPositionOptions): vscode.CompletionList | undefined => {

		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = shared.uriToFsPath(document.uri);
		const offset = document.offsetAt(position);

		let completionContext: ReturnType<typeof languageService.getCompletionsAtPosition> | undefined;
		try { completionContext = languageService.getCompletionsAtPosition(fileName, offset, options); } catch { }
		if (completionContext === undefined) return;

		const wordRange = completionContext.optionalReplacementSpan ? vscode.Range.create(
			document.positionAt(completionContext.optionalReplacementSpan.start),
			document.positionAt(completionContext.optionalReplacementSpan.start + completionContext.optionalReplacementSpan.length),
		) : undefined;

		let line = document.getText({ start: position, end: { line: position.line + 1, character: 0 } });
		if (line.endsWith('\n')) {
			line = line.substring(0, line.length - 1);
		}

		const dotAccessorContext = getDotAccessorContext(ts.version, document);

		const entries = completionContext.entries
			.map(tsEntry => {

				const item = vscode.CompletionItem.create(tsEntry.name);

				item.kind = convertKind(tsEntry.kind);

				if (tsEntry.source && tsEntry.hasAction) {
					// De-prioritze auto-imports
					// https://github.com/microsoft/vscode/issues/40311
					item.sortText = '\uffff' + tsEntry.sortText;

				} else {
					item.sortText = tsEntry.sortText;
				}

				const { sourceDisplay, isSnippet } = tsEntry;
				if (sourceDisplay) {
					item.labelDetails = { description: ts.displayPartsToString(tsEntry.sourceDisplay) };
				}

				item.preselect = tsEntry.isRecommended;

				let range: vscode.Range | ReturnType<typeof getRangeFromReplacementSpan> = getRangeFromReplacementSpan(tsEntry, document);
				item.commitCharacters = getCommitCharacters(tsEntry, {
					isNewIdentifierLocation: completionContext!.isNewIdentifierLocation,
					isInValidCommitCharacterContext: isInValidCommitCharacterContext(document, position, ts.version),
					enableCallCompletions: true, // TODO: suggest.completeFunctionCalls
				});
				item.insertText = tsEntry.insertText;
				item.insertTextFormat = isSnippet ? vscode.InsertTextFormat.Snippet : vscode.InsertTextFormat.PlainText;
				item.filterText = getFilterText(tsEntry, wordRange, line, tsEntry.insertText);

				if (completionContext!.isMemberCompletion && dotAccessorContext && !isSnippet) {
					item.filterText = dotAccessorContext.text + (item.insertText || item.label);
					if (!range) {
						const replacementRange = wordRange;
						if (replacementRange) {
							range = {
								inserting: dotAccessorContext.range,
								replacing: rangeUnion(dotAccessorContext.range, replacementRange),
							};
						} else {
							range = dotAccessorContext.range;
						}
						item.insertText = item.filterText;
					}
				}

				handleKindModifiers(item, tsEntry);

				if (!range && wordRange) {
					range = {
						inserting: vscode.Range.create(wordRange.start, position),
						replacing: wordRange,
					}
				}

				if (range) {
					if (vscode.Range.is(range)) {
						item.textEdit = vscode.TextEdit.replace(range, item.insertText || item.label);
					}
					else {
						item.textEdit = vscode.InsertReplaceEdit.create(item.insertText || item.label, range.inserting, range.replacing);
					}
				}

				const data: Data = {
					uri,
					fileName,
					offset,
					source: tsEntry.source,
					name: tsEntry.name,
					tsData: tsEntry.data,
				};
				// @ts-expect-error
				item.data = data;

				return item;
			});

		return {
			isIncomplete: !!completionContext.isIncomplete,
			items: entries,
		};

		function getDotAccessorContext(tsVersion: string, document: TextDocument) {
			let dotAccessorContext: {
				range: vscode.Range;
				text: string;
			} | undefined;

			if (semver.gte(tsVersion, '3.0.0')) {

				if (!completionContext)
					return;

				const isMemberCompletion = completionContext.isMemberCompletion;
				if (isMemberCompletion) {
					const dotMatch = line.slice(0, position.character).match(/\??\.\s*$/) || undefined;
					if (dotMatch) {
						const range = vscode.Range.create({ line: position.line, character: position.character - dotMatch[0].length }, position);
						const text = document.getText(range);
						dotAccessorContext = { range, text };
					}
				}
			}

			return dotAccessorContext;
		}

		// from vscode typescript
		function getRangeFromReplacementSpan(tsEntry: ts.CompletionEntry, document: TextDocument) {
			if (!tsEntry.replacementSpan) {
				return;
			}

			let replaceRange = vscode.Range.create(
				document.positionAt(tsEntry.replacementSpan.start),
				document.positionAt(tsEntry.replacementSpan.start + tsEntry.replacementSpan.length),
			);
			// Make sure we only replace a single line at most
			if (replaceRange.start.line !== replaceRange.end.line) {
				replaceRange = vscode.Range.create(
					replaceRange.start.line,
					replaceRange.start.character,
					replaceRange.start.line,
					document.positionAt(document.offsetAt({ line: replaceRange.start.line + 1, character: 0 }) - 1).character,
				);
			}

			// If TS returns an explicit replacement range, we should use it for both types of completion
			return {
				inserting: replaceRange,
				replacing: replaceRange,
			};
		}

		function getFilterText(tsEntry: ts.CompletionEntry, wordRange: vscode.Range | undefined, line: string, insertText: string | undefined): string | undefined {
			// Handle private field completions
			if (tsEntry.name.startsWith('#')) {
				const wordStart = wordRange ? line.charAt(wordRange.start.character) : undefined;
				if (insertText) {
					if (insertText.startsWith('this.#')) {
						return wordStart === '#' ? insertText : insertText.replace(/^this\.#/, '');
					} else {
						return insertText;
					}
				} else {
					return wordStart === '#' ? undefined : tsEntry.name.replace(/^#/, '');
				}
			}

			// For `this.` completions, generally don't set the filter text since we don't want them to be overly prioritized. #74164
			if (insertText?.startsWith('this.')) {
				return undefined;
			}

			// Handle the case:
			// ```
			// const xyz = { 'ab c': 1 };
			// xyz.ab|
			// ```
			// In which case we want to insert a bracket accessor but should use `.abc` as the filter text instead of
			// the bracketed insert text.
			else if (insertText?.startsWith('[')) {
				return insertText.replace(/^\[['"](.+)[['"]\]$/, '.$1');
			}

			// In all other cases, fallback to using the insertText
			return insertText;
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

		function getCommitCharacters(entry: ts.CompletionEntry, context: {
			isNewIdentifierLocation: boolean,
			isInValidCommitCharacterContext: boolean,
			enableCallCompletions: boolean,
		}): string[] | undefined {
			if (entry.kind === PConst.Kind.warning) { // Ambient JS word based suggestion
				return undefined;
			}

			if (context.isNewIdentifierLocation || !context.isInValidCommitCharacterContext) {
				return undefined;
			}

			const commitCharacters: string[] = ['.', ',', ';'];
			if (context.enableCallCompletions) {
				commitCharacters.push('(');
			}

			return commitCharacters;
		}

		function isInValidCommitCharacterContext(
			document: TextDocument,
			position: vscode.Position,
			tsVersion: string,
		): boolean {
			if (semver.lt(tsVersion, '3.2.0')) {
				// Workaround for https://github.com/microsoft/TypeScript/issues/27742
				// Only enable dot completions when previous character not a dot preceded by whitespace.
				// Prevents incorrectly completing while typing spread operators.
				if (position.character > 1) {
					const preText = document.getText(vscode.Range.create(
						position.line, 0,
						position.line, position.character));
					return preText.match(/(\s|^)\.$/ig) === null;
				}
			}

			return true;
		}
	}
}

export function handleKindModifiers(item: vscode.CompletionItem, tsEntry: ts.CompletionEntry | ts.CompletionEntryDetails) {
	if (tsEntry.kindModifiers) {
		const kindModifiers = parseKindModifier(tsEntry.kindModifiers);
		if (kindModifiers.has(PConst.KindModifiers.optional)) {
			if (!item.insertText) {
				item.insertText = item.label;
			}

			if (!item.filterText) {
				item.filterText = item.label;
			}
			item.label += '?';
		}
		if (kindModifiers.has(PConst.KindModifiers.deprecated)) {
			item.tags = [vscode.CompletionItemTag.Deprecated];
		}

		if (kindModifiers.has(PConst.KindModifiers.color)) {
			item.kind = vscode.CompletionItemKind.Color;
		}

		if (tsEntry.kind === PConst.Kind.script) {
			for (const extModifier of PConst.KindModifiers.fileExtensionKindModifiers) {
				if (kindModifiers.has(extModifier)) {
					if (tsEntry.name.toLowerCase().endsWith(extModifier)) {
						item.detail = tsEntry.name;
					} else {
						item.detail = tsEntry.name + extModifier;
					}
					break;
				}
			}
		}
	}
}

function rangeUnion(a: vscode.Range, b: vscode.Range): vscode.Range {
	const start = (a.start.line < b.start.line || (a.start.line === b.start.line && a.start.character < b.start.character)) ? a.start : b.start;
	const end = (a.end.line > b.end.line || (a.end.line === b.end.line && a.end.character > b.end.character)) ? a.end : b.end;
	return { start, end };
}
