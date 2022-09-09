import { CodeGen } from '@volar/code-gen';
import { Mapping } from '@volar/source-map';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { EmbeddedFileSourceMap, Teleport } from './sourceMaps';

export interface EmbeddedStructure {
	self: Embedded | undefined,
	embeddeds: EmbeddedStructure[],
}

export interface Embedded {
	file: EmbeddedFile,
	sourceMap: EmbeddedFileSourceMap,
	teleport: Teleport | undefined,
}

export interface EmbeddedFile {
	parentFileName?: string,
	fileName: string,
	isTsHostFile: boolean,
	capabilities: {
		diagnostics: boolean,
		foldingRanges: boolean,
		formatting: boolean | {
			initialIndentBracket?: [string, string],
		},
		documentSymbol: boolean,
		codeActions: boolean,
		inlayHints: boolean,
	},
	codeGen: CodeGen<EmbeddedFileMappingData>,
	teleportMappings: Mapping<TeleportMappingData>[],
};

export interface EmbeddedFileMappingData {
	vueTag: 'template' | 'script' | 'scriptSetup' | 'scriptSrc' | 'style' | 'customBlock' | undefined,
	vueTagIndex?: number,
	normalizeNewName?: (newName: string) => string,
	applyNewName?: (oldName: string, newName: string) => string,
	capabilities: {
		basic?: boolean,
		references?: boolean,
		definitions?: boolean,
		diagnostic?: boolean,
		rename?: boolean | {
			in: boolean,
			out: boolean,
		},
		completion?: boolean | {
			additional: boolean,
		},
		semanticTokens?: boolean,
		referencesCodeLens?: boolean,
		displayWithLink?: boolean,
	},
}

export interface TeleportSideData {
	capabilities: {
		references?: boolean,
		definitions?: boolean,
		rename?: boolean,
	},
}

export interface TeleportMappingData {
	toSource: TeleportSideData,
	toTarget: TeleportSideData,
}

export interface TextRange {
	start: number,
	end: number,
}

export interface EmbeddedLangaugeSourceFile {
	fileName: string,
	text: string,
	embeddeds: EmbeddedStructure[],
}

export interface EmbeddedLanguageModule {
	createSourceFile(fileName: string, snapshot: ts.IScriptSnapshot): EmbeddedLangaugeSourceFile | undefined;
	updateSourceFile(sourceFile: EmbeddedLangaugeSourceFile, snapshot: ts.IScriptSnapshot): void;
}

export type EmbeddedTypeScriptLanguageServiceHost = ts.LanguageServiceHost & {
	getTypeScriptModule(): typeof import('typescript/lib/tsserverlibrary');
	isTsPlugin?: boolean,
	isTsc?: boolean,
};
