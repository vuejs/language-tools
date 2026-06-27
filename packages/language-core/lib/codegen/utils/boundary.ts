import type { Code, VueCodeInformation } from '../../types';

export class Boundary {
	private constructor(
		public source: string,
		public features: VueCodeInformation,
	) {}

	static *start(source: string, offset: number, features: VueCodeInformation): Generator<Code, Boundary> {
		features = { ...features, __combineToken: Symbol() };
		yield [``, source, offset, features];
		return new Boundary(source, features);
	}

	end(offset: number): Code {
		return [``, this.source, offset, this.features];
	}
}
