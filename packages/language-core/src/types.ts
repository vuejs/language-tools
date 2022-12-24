import { Mapping } from '@volar/source-map';
import type * as ts from 'typescript/lib/tsserverlibrary';

export interface DocumentCapabilities {
	diagnostic?: boolean,
	foldingRange?: boolean,
	documentFormatting?: boolean | {
		initialIndentBracket?: [string, string],
	},
	documentSymbol?: boolean,
	codeAction?: boolean,
	inlayHint?: boolean,
}

export interface PositionCapabilities {
	hover?: boolean,
	references?: boolean,
	definition?: boolean,
	rename?: boolean | {
		normalize?(newName: string): string,
		apply?(newName: string): string,
	},
	completion?: boolean | {
		additional?: boolean,
		autoImportOnly?: boolean,
	},
	diagnostic?: boolean,
	semanticTokens?: boolean,

	// TODO
	referencesCodeLens?: boolean,
	displayWithLink?: boolean,
}

export interface TeleportCapabilities {
	references?: boolean,
	definition?: boolean,
	rename?: boolean,
}

export interface TeleportMappingData {
	toSourceCapabilities: TeleportCapabilities,
	toGeneratedCapabilities: TeleportCapabilities,
}

export interface TextRange {
	start: number,
	end: number,
}

export enum VirtualFileKind {
	TextFile = 0,
	TypeScriptHostFile = 1,
}

export interface VirtualFile {
	fileName: string,
	snapshot: ts.IScriptSnapshot,
	kind: VirtualFileKind,
	capabilities: DocumentCapabilities,
	mappings: Mapping<PositionCapabilities>[],
	teleportMappings?: Mapping<TeleportMappingData>[],
	embeddedFiles: VirtualFile[],
}

export interface LanguageModule<T extends VirtualFile = VirtualFile> {
	createFile(fileName: string, snapshot: ts.IScriptSnapshot): T | undefined;
	updateFile(virtualFile: T, snapshot: ts.IScriptSnapshot): void;
	deleteFile?(virtualFile: T): void;
	proxyLanguageServiceHost?(host: LanguageServiceHost): Partial<LanguageServiceHost>;
}

export interface LanguageServiceHost extends ts.LanguageServiceHost {
	getTypeScriptModule(): typeof import('typescript/lib/tsserverlibrary');
	isTsc?: boolean,
};
