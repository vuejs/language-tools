import * as ts from 'typescript';
import * as PConst from '../protocol.const';
import {
	Position,
	CompletionItem,
	CompletionItemKind,
	Range,
	TextDocument,
	TextEdit,
	CompletionContext,
} from 'vscode-languageserver';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService) {
	return (document: TextDocument, position: Position, _options?: ts.GetCompletionsAtPositionOptions, context?: CompletionContext): CompletionItem[] => {
		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const options: ts.GetCompletionsAtPositionOptions = {
			disableSuggestions: false,
			// includeCompletionsForModuleExports: true,
			includeAutomaticOptionalChainCompletions: true,
			includeCompletionsWithInsertText: true,
			importModuleSpecifierPreference: 'auto',
			// importModuleSpecifierEnding: 'minimal' | 'index' | 'js',
			allowTextChangesInNewFiles: true,
			providePrefixAndSuffixTextForRename: true,
		};
		if (context) {
			options.triggerCharacter = context.triggerCharacter as ts.CompletionsTriggerCharacter;
		}
		for (const key in _options) {
			(options as any)[key] = (_options as any)[key];
		}

		const completions = languageService.getCompletionsAtPosition(fileName, offset, options);
		if (completions === undefined) return [];

		const entries = completions.entries
			.map(entry => {
				let item: CompletionItem = {
					label: entry.name,
					kind: convertKind(entry.kind),
					sortText: entry.sortText,
					insertText: entry.insertText,
					preselect: entry.isRecommended,
					commitCharacters: getCommitCharacters(entry),
					data: {
						fileName,
						offset,
					},
				}

				item = fuzzyCompletionItem(entry, item);

				return item;
			});
		return entries;

		// from vscode typescript
		function fuzzyCompletionItem(entry: ts.CompletionEntry, item: CompletionItem) {
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
				const range = Range.create(
					document.positionAt(entry.replacementSpan.start),
					document.positionAt(entry.replacementSpan.start + entry.replacementSpan.length),
				);
				item.additionalTextEdits = [TextEdit.del(range)];
			}
			else {
				/**
				 * @before
				 * $f + $foo => $$foo
				 * @after
				 * $f + $foo => $foo
				 */
				const range = getFuzzyWordRange(
					document.getText(Range.create(
						Position.create(position.line, 0),
						position
					)),
					item.label,
					position
				);
				if (range) {
					item.textEdit = TextEdit.replace(range, item.insertText ?? item.label);
				}
			}

			return item;
		}
		function getFuzzyWordRange(line: string, label: string, position: Position) {
			// Try getting longer, prefix based range for completions that span words
			const text = line.slice(Math.max(0, position.character - label.length), position.character).toLowerCase();
			const entryName = label.toLowerCase();
			for (let i = entryName.length; i > 0; --i) {
				if (text.endsWith(entryName.substr(0, i))) {
					return Range.create(
						Position.create(position.line, Math.max(0, position.character - i)),
						position
					)
				}
			}

			return undefined;
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
