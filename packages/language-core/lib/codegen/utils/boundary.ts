import type { Code, VueCodeMarker } from '../../types';
import { toAtomGroup } from '../codeFeatures';

export class Boundary {
	private constructor(
		private source: string,
		private endOffset: number,
		public features: VueCodeMarker,
	) {}

	static *start(source: string, start: number, end: number, features: VueCodeMarker): Generator<Code, Boundary> {
		features = toAtomGroup(features);
		yield [``, source, start, features];
		return new Boundary(source, end, features);
	}

	end(): Code {
		return [``, this.source, this.endOffset, this.features];
	}
}
