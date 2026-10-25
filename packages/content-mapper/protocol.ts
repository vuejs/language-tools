import type { Mapping as SpanMapping } from '@volar/language-core';

export interface InitializeParams {
	locale?: string;
	positionEncodings: PositionEncoding[];
}

export interface InitializeResult {
	positionEncoding: PositionEncoding;
	diagnosticSource: string;
}

export interface OpenProjectParams {
	configFileName: string;
	projectHandle: string;
	options?: MapperOptions;
	compilerOptions: Record<string, unknown>;
}

export interface OpenProjectResult {
	configIdentity: string;
	watchedFiles?: string[];
	optionDiagnostics?: OptionDiagnostic[];
}

export interface OptionDiagnostic {
	/** Property path into the mapper entry's `options` object. */
	path: (string | number)[];
	messageText: string;
	code: number;
}

export interface CloseProjectParams {
	projectHandle: string;
}

export interface TransformParams {
	fileName: string;
	content: string;
	projectHandle: string;
}

export interface TransformResult {
	text: string;
	extension: VirtualExtension;
	mappings: SpanMapping[];
	diagnosticDirectives?: DiagnosticDirectives;
}

export interface MapperOptions {
	languageFeatures?: boolean;
	format?: 'sfc' | 'vitepress' | 'petite-vue';
	[option: string]: unknown;
}

export interface DiagnosticDirectives {
	unusedExpectDirectiveDiagnostics: UnusedExpectDirectiveDiagnostic[];
	directives: DiagnosticDirectiveMapping[];
}

export interface UnusedExpectDirectiveDiagnostic {
	code: number;
	messageText: string;
}

/** The diagnostic directive policies of the Content Mapper protocol of TypeScript 7.1. */
export enum DiagnosticDirectivePolicy {
	Ignore,
	Expect,
}

/** A diagnostic directive of the Content Mapper protocol of TypeScript 7.1. */
export type DiagnosticDirectiveMapping = [
	originalStart: number,
	originalLength: number,
	virtualStart: number,
	virtualEnd: number,
	policy: DiagnosticDirectivePolicy,
	unusedExpectDirectiveIndex?: number,
];

export type PositionEncoding = 'utf-8' | 'utf-16';
export type VirtualExtension =
	| '.js'
	| '.jsx'
	| '.mjs'
	| '.cjs'
	| '.ts'
	| '.tsx'
	| '.mts'
	| '.cts'
	| '.json';

export type { SpanMapping };
export { SpanMapFeature, SpanMapKind } from '@volar/language-core';
