import type { Mapping } from '@volar/language-core';
import type { Code } from '../types';

export class VueEmbeddedCode {

	public parentCodeId?: string;
	public linkedCodeMappings: Mapping[] = [];
	public embeddedCodes: VueEmbeddedCode[] = [];

	constructor(
		public id: string,
		public lang: string,
		public content: Code[],
	) { }
}
