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
}

export interface CloseProjectParams {
	projectHandle: string;
}

export interface TransformParams {
	fileName: string;
	content: string;
	options?: MapperOptions;
	projectHandle?: string;
	compilerOptions?: Record<string, unknown>;
}

export interface TransformResult {
	text: string;
	extension: VirtualExtension;
	mappings: SpanMapping[];
	diagnosticDirectives?: DiagnosticDirectives;
}

export interface MapperOptions {
	languageFeatures?: boolean;
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

export enum DiagnosticDirectivePolicy {
	Ignore,
	Expect,
}

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

export enum SpanMapKind {
	Verbatim,
	Atom,
	Alias,
}

export enum SpanMapFeature {
	Hover = 1 << 0,
	SignatureHelp = 1 << 1,
	Completion = 1 << 2,
	Definition = 1 << 3,
	TypeDefinition = 1 << 4,
	Implementation = 1 << 5,
	SourceDefinition = 1 << 6,
	References = 1 << 7,
	DocumentHighlights = 1 << 8,
	Rename = 1 << 9,
	CallHierarchy = 1 << 10,
	CodeActions = 1 << 11,
	Formatting = 1 << 12,
	InlayHints = 1 << 13,
	SemanticTokens = 1 << 14,
	FoldingRanges = 1 << 15,
	SelectionRanges = 1 << 16,
	LinkedEditing = 1 << 17,
	AutoInsert = 1 << 18,
	DocumentSymbols = 1 << 19,
	CodeLens = 1 << 20,
}

export type SpanMapping = [
	generatedStart: number,
	generatedLength: number,
	originalStart: number,
	originalLength: number,
	kind: SpanMapKind,
	features: number,
];
