import type { Code, VueCodeInformation } from '../../types';
import { toAtomGroup } from '../codeFeatures';

export class Boundary {
	private constructor(
		private source: string,
		private endOffset: number,
		public features: VueCodeInformation,
	) {}

	static *start(source: string, start: number, end: number, features: VueCodeInformation): Generator<Code, Boundary> {
		features = toAtomGroup(features);
		yield [``, source, start, features];
		return new Boundary(source, end, features);
	}

	end(): Code {
		return [``, this.source, this.endOffset, this.features];
	}
}
