import type { Code, CodeBoundary, DiagnosticDirectiveMapping, VueCodeMarker } from '../../types';

const end: CodeBoundary = Object.freeze({ end: true as const });

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
