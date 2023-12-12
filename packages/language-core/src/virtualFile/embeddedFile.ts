import { Mapping, StackNode, VirtualFile } from '@volar/language-core';
import { Code } from '../types';

export class VueEmbeddedFile {

	public parentFileName?: string;
	public typescript: VirtualFile['typescript'];
	public linkedCodeMappings: Mapping[] = [];

	constructor(
		public fileName: string,
		public content: Code[],
		public contentStacks: StackNode[],
	) { }
}
