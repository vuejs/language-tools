import type { Mapping, StackNode } from '@volar/language-core';
import type { Code } from '../types';

export class VueEmbeddedFile {

	public parentFileId?: string;
	public linkedCodeMappings: Mapping[] = [];
	public embeddedFiles: VueEmbeddedFile[] = [];

	constructor(
		public id: string,
		public lang: string,
		public content: Code[],
		public contentStacks: StackNode[],
	) { }
}
