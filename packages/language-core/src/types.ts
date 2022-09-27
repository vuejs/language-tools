import { Mapping } from '@volar/source-map';
import type * as ts from 'typescript/lib/tsserverlibrary';

export interface DocumentCapabilities {
	diagnostics?: boolean,
	foldingRanges?: boolean,
	formatting?: boolean | {
		initialIndentBracket?: [string, string],
	},
	documentSymbol?: boolean,
	codeActions?: boolean,
	inlayHints?: boolean,
}

export interface PositionCapabilities {
	hover?: boolean,
	references?: boolean,
	definitions?: boolean,
	rename?: boolean | {
		normalize?(newName: string): string,
		apply?(oldName: string, newName: string): string,
	},
	completion?: boolean | {
		additional: boolean,
	},
	diagnostic?: boolean,
	semanticTokens?: boolean,

	// TODO
	referencesCodeLens?: boolean,
	displayWithLink?: boolean,
}

export interface TeleportCapabilities {
	references?: boolean,
	definitions?: boolean,
	rename?: boolean,
}

export interface TeleportMappingData {
	toSourceCapabilities: TeleportCapabilities,
	toGenedCapabilities: TeleportCapabilities,
}

export interface TextRange {
	start: number,
	end: number,
}

export interface SourceFile {
	fileName: string,
	text: string,
	embeddeds: EmbeddedFile[],
}

export const enum EmbeddedFileKind {
	TextFile = 0,
	TypeScriptHostFile = 1,
}

export interface EmbeddedFile {
	fileName: string,
	text: string,
	kind: EmbeddedFileKind,
	capabilities: DocumentCapabilities,
	mappings: Mapping<PositionCapabilities>[],
	teleportMappings?: Mapping<TeleportMappingData>[],
	embeddeds: EmbeddedFile[],
}

export interface EmbeddedLanguageModule<T extends SourceFile = SourceFile> {
	createSourceFile(fileName: string, snapshot: ts.IScriptSnapshot): T | undefined;
	updateSourceFile(sourceFile: T, snapshot: ts.IScriptSnapshot): void;
	proxyLanguageServiceHost?(host: LanguageServiceHost): Partial<LanguageServiceHost>;
}

export type LanguageServiceHost = ts.LanguageServiceHost & {
	getTypeScriptModule(): typeof import('typescript/lib/tsserverlibrary');
	isTsPlugin?: boolean,
	isTsc?: boolean,
};
