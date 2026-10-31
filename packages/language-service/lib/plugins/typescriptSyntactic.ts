import type {
	DocumentSymbol,
	EmbeddedCodeFormattingOptions,
	FoldingRange,
	FormattingOptions,
	LanguageServiceContext,
	LanguageServicePlugin,
	Position,
	Range,
	SelectionRange,
	TextDocument,
	TextEdit,
} from '@volar/language-service';
import type { IRScript } from '@vue/language-core';
import { getTypeScriptAST } from '@vue/language-core/lib/typescript/typescriptAST';
import { embeddedCodeIds } from '../virtualCode';
import { resolveEmbeddedCode } from '../virtualCodeQueries';

type SourceFile = IRScript['ast'];

export interface SyntacticFormatOptions {
	tabSize: number;
	insertSpaces: boolean;
	/** The indent of the whole block, from `vue.format.*.initialIndent`. */
	baseIndentSize: number;
}

/**
 * The syntactic features of a script block or a template expression, computed from its parsed AST alone: no language
 * service, program or project. They wait on a project-free syntactic API of TypeScript 7.1 `typescript/sync` for a
 * RetainedSourceFile, which does not exist yet, so no implementation is passed and the providers return nothing.
 *
 * They ran on classic TypeScript (5/6) before. It stays out even as an interim solution: it is a second TypeScript
 * that parses each block again, a second syntax tree that can disagree with the one of TS 7.1 that every other feature
 * reads, so the same file gets different results by feature; it keeps a second compiler loaded in the server; and it
 * implements beside TS 7.1 what TS 7.1 owns, which leaves TypeScript nothing to answer. Porting the Go code is the
 * same parallel implementation. So the interface stays and the features wait: the tests of them are expected
 * failures, and the shape of this interface is ours, a guess at the upstream API to adapt when it lands.
 */
export interface SyntacticApi {
	getFoldingRanges(sourceFile: SourceFile): FoldingRange[];
	getSelectionRanges(sourceFile: SourceFile, positions: Position[]): SelectionRange[];
	getDocumentSymbols(sourceFile: SourceFile): DocumentSymbol[];
	formatDocument(sourceFile: SourceFile, options: SyntacticFormatOptions): TextEdit[];
	formatRange(sourceFile: SourceFile, range: Range, options: SyntacticFormatOptions): TextEdit[];
	formatOnType(sourceFile: SourceFile, position: Position, key: string, options: SyntacticFormatOptions): TextEdit[];
	getJsxClosingTag(sourceFile: SourceFile, position: Position): string | undefined;
}

export function create(api: Partial<SyntacticApi> = {}): LanguageServicePlugin {
	return {
		name: 'vue-typescript-syntactic',
		capabilities: {
			autoInsertionProvider: {
				triggerCharacters: ['>'],
			},
			foldingRangeProvider: true,
			selectionRangeProvider: true,
			documentSymbolProvider: true,
			documentFormattingProvider: true,
			documentOnTypeFormattingProvider: {
				// https://github.com/microsoft/vscode/blob/ce119308e8fd4cd3f992d42b297588e7abe33a0c/extensions/typescript-language-features/src/languageFeatures/formatting.ts#L99
				triggerCharacters: [';', '}', '\n'],
			},
		},
		create(context) {
			return {
				provideAutoInsertSnippet(document, selection, change) {
					if (
						document.offsetAt(selection) !== change.rangeOffset + change.text.length
						|| !change.text.endsWith('>')
						|| (document.languageId !== 'javascriptreact' && document.languageId !== 'typescriptreact')
					) {
						return;
					}
					const sourceFile = api.getJsxClosingTag && getScriptAST(context, document);
					const close = sourceFile && api.getJsxClosingTag!(sourceFile, selection);
					if (close) {
						return '$0' + close;
					}
				},
				provideFoldingRanges(document) {
					const sourceFile = api.getFoldingRanges && getScriptAST(context, document);
					return sourceFile && api.getFoldingRanges!(sourceFile);
				},
				provideSelectionRanges(document, positions) {
					const sourceFile = api.getSelectionRanges && getScriptAST(context, document);
					return sourceFile && api.getSelectionRanges!(sourceFile, positions);
				},
				provideDocumentSymbols(document) {
					const sourceFile = api.getDocumentSymbols && getScriptAST(context, document);
					return sourceFile && api.getDocumentSymbols!(sourceFile);
				},
				provideDocumentFormattingEdits(document, range, options, codeOptions) {
					const format = range ? api.formatRange : api.formatDocument;
					const sourceFile = format && getFormattedAST(context, document);
					if (!sourceFile) {
						return;
					}
					const formatOptions = getFormatOptions(options, codeOptions);
					return range
						? api.formatRange!(sourceFile, range, formatOptions)
						: api.formatDocument!(sourceFile, formatOptions);
				},
				provideOnTypeFormattingEdits(document, position, key, options, codeOptions) {
					const sourceFile = api.formatOnType && getFormattedAST(context, document);
					return sourceFile && api.formatOnType!(sourceFile, position, key, getFormatOptions(options, codeOptions));
				},
			};
		},
	};
}

function getFormatOptions(
	options: FormattingOptions,
	codeOptions: EmbeddedCodeFormattingOptions | undefined,
): SyntacticFormatOptions {
	return {
		tabSize: options.tabSize,
		insertSpaces: options.insertSpaces,
		baseIndentSize: (codeOptions?.initialIndentLevel ?? 0) * options.tabSize,
	};
}

/** The AST of the script block that `document` holds verbatim, as the IR parsed it. */
function getScriptAST(context: LanguageServiceContext, document: TextDocument) {
	const info = resolveEmbeddedCode(context, document.uri);
	if (info?.code.id === embeddedCodeIds.scriptRaw) {
		return info.root.ir.script?.ast;
	}
	if (info?.code.id === embeddedCodeIds.scriptSetupRaw) {
		return info.root.ir.scriptSetup?.ast;
	}
}

/** The AST of a script block, or of a template expression wrapped into a TypeScript statement for the formatter. */
function getFormattedAST(context: LanguageServiceContext, document: TextDocument) {
	const info = resolveEmbeddedCode(context, document.uri);
	const template = info?.root.ir.template;
	if (template && info.code.id.startsWith(embeddedCodeIds.templateInlineTsPrefix)) {
		return getTypeScriptAST(info.root.ts, template, document.getText());
	}
	return getScriptAST(context, document);
}
