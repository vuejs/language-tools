import type { CodePiece, CodeSource, VueCodeMarker } from '@vue/language-core';
import { type DiagnosticDirectiveMapping, DiagnosticDirectivePolicy } from '../protocol';
import type { PluginSlice } from './plugin';

/**
 * The data of an empty piece bounding a range of generated code. A start carries what the range is: the span
 * from its source offset to the one of its end, which the enclosed pieces without data map only as part of,
 * or a diagnostic directive covering the range, whose original start is the source offset of the start.
 * An end closes the innermost open range.
 */
export type CodeBoundary = { start: VueCodeMarker | DiagnosticDirectiveMapping } | { end: true };

/** The data of a piece of generated TypeScript code. */
export type TsCodeData = VueCodeMarker | CodeBoundary | undefined;

/** A piece of generated TypeScript code. */
export type TsPiece = CodePiece<TsCodeData>;

/**
 * Generated TypeScript code: a piece, or a slice of a codegen plugin, which renders once all edits of the rewrites of
 * the script blocks are made.
 */
export type TsCode = TsPiece | PluginSlice;

/** A piece whose `text` maps char by char from `start`. */
export interface MappedPiece<Data extends TsCodeData, Source extends CodeSource = CodeSource> {
	source: Source;
	start: number;
	end: number;
	data: Data;
	text: string;
}

/** `text`, which maps by `data` char by char from `offset` of `source`. */
export function mapped<Data extends TsCodeData, Source extends CodeSource>(
	text: string,
	source: Source,
	offset: number,
	data: Data,
): MappedPiece<Data, Source> {
	return { source, start: offset, end: offset + text.length, data, text };
}

const end: CodeBoundary = Object.freeze({ end: true as const });

/**
 * An ignore directive without an original range, for generated code whose diagnostics are not the user's;
 * the explicit directives of directive comments take precedence over it.
 */
export const synthesizedIgnore: DiagnosticDirectiveMapping = [0, 0, 0, 0, DiagnosticDirectivePolicy.Ignore];

export function isSynthesizedIgnore(directive: DiagnosticDirectiveMapping) {
	return directive[4] === DiagnosticDirectivePolicy.Ignore && directive[1] === 0;
}

/** A range of generated code, bounded by empty pieces that pair by nesting. */
export class Boundary<Source extends CodeSource = CodeSource> {
	private constructor(
		private source: Source,
		private endOffset: number,
	) {}

	static *start<Source extends CodeSource>(
		source: Source,
		start: number,
		end: number,
		data: VueCodeMarker | DiagnosticDirectiveMapping,
	): Generator<MappedPiece<CodeBoundary, Source>, Boundary<Source>> {
		yield mapped(``, source, start, { start: data });
		return new Boundary(source, end);
	}

	end(): MappedPiece<CodeBoundary, Source> {
		return mapped(``, this.source, this.endOffset, end);
	}
}

type OpenRange<M> =
	| { mapping: M; directive?: undefined }
	| { mapping?: undefined; directive: DiagnosticDirectiveMapping };

/** The ranges open at a point of a segment sequence, paired by nesting. */
export class OpenRanges<M> {
	private ranges: OpenRange<M>[] = [];
	private mappings: M[] = [];

	/** The innermost open mapping range, which a segment without data maps as part of. */
	get mapping(): M | undefined {
		return this.mappings.at(-1);
	}

	get size() {
		return this.ranges.length;
	}

	start(range: OpenRange<M>) {
		this.ranges.push(range);
		if (range.mapping !== undefined) {
			this.mappings.push(range.mapping);
		}
	}

	/** Closes the innermost open range; `undefined` if none is open. */
	end(): OpenRange<M> | undefined {
		const range = this.ranges.pop();
		if (range?.mapping !== undefined) {
			this.mappings.pop();
		}
		return range;
	}
}
