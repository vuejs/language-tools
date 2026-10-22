import type * as ts from 'typescript';
import type { VueCompletionData } from '../common';

type Response<T> = T | null | undefined | Promise<T | null | undefined>;

export interface ComponentPropInfo {
	name: string;
	description?: string;
	optional?: boolean;
	boolean?: boolean;
}

export interface Requests {
	collectExtractProps(
		fileName: string,
		templateCodeRange: [number, number],
	): Response<ReturnType<typeof import('./collectExtractProps.js')['collectExtractProps']>>;
	/** Edits in UTF-16 offsets of `fileName`'s source text that add a default import of `incomingFileName`. */
	getDefaultImportEdits(
		fileName: string,
		incomingFileName: string,
	): Response<readonly { pos: number; end: number; newText: string }[]>;
	isRefAtPosition(
		fileName: string,
		position: number,
	): Response<ReturnType<typeof import('./isRefAtPosition.js')['isRefAtPosition']>>;
	getComponentDirectives(
		fileName: string,
	): Response<string[]>;
	getComponentMeta(
		fileName: string,
		tag: string,
	): Response<import('vue-component-meta').ComponentMeta>;
	getComponentNames(
		fileName: string,
	): Response<string[]>;
	getComponentProps(
		fileName: string,
		position: number,
	): Response<ComponentPropInfo[]>;
	getComponentSlots(
		fileName: string,
	): Response<ReturnType<typeof import('./getComponentSlots.js')['getComponentSlots']>>;
	getElementAttrs(
		fileName: string,
		tag: string,
	): Response<ComponentPropInfo[]>;
	getElementNames(
		fileName: string,
	): Response<string[]>;
	getAutoImportSuggestions(
		fileName: string,
		position: number,
	): Response<ts.CompletionInfo>;
	resolveAutoImportCompletionEntry(
		data: VueCompletionData,
	): Response<ts.CompletionEntryDetails>;
}
