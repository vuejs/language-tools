import {
	type Code,
	type CodeBoundary,
	type DiagnosticDirectiveMapping,
	DiagnosticDirectivePolicy,
	type VueCodeMarker,
} from '../types';

const end: CodeBoundary = Object.freeze({ end: true as const });

/**
 * An ignore directive without an original range, for generated code whose diagnostics are not the user's;
 * the explicit directives of directive comments take precedence over it.
 */
export const synthesizedIgnore: DiagnosticDirectiveMapping = [0, 0, 0, 0, DiagnosticDirectivePolicy.Ignore];

export function isSynthesizedIgnore(directive: DiagnosticDirectiveMapping) {
	return directive[4] === DiagnosticDirectivePolicy.Ignore && directive[1] === 0;
}

/** A range of generated code, bounded by empty segments that pair by nesting. */
export class Boundary {
	private constructor(
		private source: string,
		private endOffset: number,
	) {}

	static *start(
		source: string,
		start: number,
		end: number,
		data: VueCodeMarker | DiagnosticDirectiveMapping,
	): Generator<Code, Boundary> {
		yield [``, source, start, { start: data }];
		return new Boundary(source, end);
	}

	end(): Code {
		return [``, this.source, this.endOffset, end];
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
