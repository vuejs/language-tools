import type * as ts from 'typescript';
import type { VueCompletionData } from '../common.js';

type Response<T> = T | null | undefined | Promise<T | null | undefined>;

export interface Requests {
	collectExtractProps(
		fileName: string,
		templateCodeRange: [number, number],
	): Response<ReturnType<typeof import('./collectExtractProps.js')['collectExtractProps']>>;
	getImportPathForFile(
		fileName: string,
		incomingFileName: string,
		preferences: ts.UserPreferences,
	): Response<ReturnType<typeof import('./getImportPathForFile.js')['getImportPathForFile']>>;
	isRefAtPosition(
		fileName: string,
		position: number,
	): Response<ReturnType<typeof import('./isRefAtPosition.js')['isRefAtPosition']>>;
	getComponentDirectives(
		fileName: string,
	): Response<ReturnType<typeof import('./getComponentDirectives.js')['getComponentDirectives']>>;
	getComponentEvents(
		fileName: string,
		tag: string,
	): Response<ReturnType<typeof import('./getComponentEvents.js')['getComponentEvents']>>;
	getComponentNames(
		fileName: string,
	): Response<ReturnType<typeof import('./getComponentNames.js')['getComponentNames']>>;
	getComponentProps(
		fileName: string,
		tag: string,
	): Response<ReturnType<typeof import('./getComponentProps.js')['getComponentProps']>>;
	getComponentSlots(
		fileName: string,
	): Response<ReturnType<typeof import('./getComponentSlots.js')['getComponentSlots']>>;
	getElementAttrs(
		fileName: string,
		tag: string,
	): Response<ReturnType<typeof import('./getElementAttrs.js')['getElementAttrs']>>;
	getElementNames(
		fileName: string,
	): Response<ReturnType<typeof import('./getElementNames.js')['getElementNames']>>;
	resolveModuleName(
		fileName: string,
		moduleName: string,
	): Response<ReturnType<typeof import('./resolveModuleName.js')['resolveModuleName']>>;
	getDocumentHighlights(
		fileName: string,
		position: number,
	): Response<ts.DocumentHighlights[]>;
	getEncodedSemanticClassifications(
		fileName: string,
		span: ts.TextSpan,
	): Response<ts.Classifications>;
	getQuickInfoAtPosition(
		fileName: string,
		position: ts.LineAndCharacter,
	): Response<string>;
	getAutoImportSuggestions(
		fileName: string,
		position: number,
	): Response<ts.CompletionInfo>;
	resolveAutoImportCompletionEntry(
		data: VueCompletionData,
	): Response<ts.CompletionEntryDetails>;
}
