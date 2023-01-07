import { Mapping } from '@volar/source-map';
import type * as ts from 'typescript/lib/tsserverlibrary';

export interface FileCapabilities {
	diagnostic?: boolean,
	foldingRange?: boolean,
	documentFormatting?: boolean | {
		initialIndentBracket?: [string, string],
	},
	documentSymbol?: boolean,
	codeAction?: boolean,
	inlayHint?: boolean,
}

export interface FileRangeCapabilities {
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

export interface MirrorBehaviorCapabilities {
	references?: boolean,
	definition?: boolean,
	rename?: boolean,
}

export namespace FileCapabilities {
	export const full: FileCapabilities = {
		diagnostic: true,
		foldingRange: true,
		documentFormatting: true,
		documentSymbol: true,
		codeAction: true,
		inlayHint: true,
	};
}

export namespace FileRangeCapabilities {
	export const full: FileRangeCapabilities = {
		hover: true,
		references: true,
		definition: true,
		rename: true,
		completion: true,
		diagnostic: true,
		semanticTokens: true,
	};
}

export namespace MirrorBehaviorCapabilities {
	export const full: MirrorBehaviorCapabilities = {
		references: true,
		definition: true,
		rename: true,
	};
}

export enum FileKind {
	TextFile = 0,
	TypeScriptHostFile = 1,
}

export interface VirtualFile {
	fileName: string,
	snapshot: ts.IScriptSnapshot,
	kind: FileKind,
	capabilities: FileCapabilities,
	mappings: Mapping<FileRangeCapabilities>[],
	mirrorBehaviorMappings?: Mapping<[MirrorBehaviorCapabilities, MirrorBehaviorCapabilities]>[],
	embeddedFiles: VirtualFile[],
}

export interface LanguageModule<T extends VirtualFile = VirtualFile> {
	createFile(fileName: string, snapshot: ts.IScriptSnapshot): T | undefined;
	updateFile(virtualFile: T, snapshot: ts.IScriptSnapshot): void;
	deleteFile?(virtualFile: T): void;
	proxyLanguageServiceHost?(host: LanguageServiceHost): Partial<LanguageServiceHost>;
}

export interface LanguageServiceHost extends ts.LanguageServiceHost {
	getTypeScriptModule(): typeof import('typescript/lib/tsserverlibrary') | undefined;
	isTsc?: boolean,
};
