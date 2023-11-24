import { CodeInformation, LinkedCodeTrigger, VirtualFile } from '@volar/language-core';
import { Mapping, Segment, StackNode } from '@volar/source-map';

export class VueEmbeddedFile {

	public parentFileName?: string;
	public typescript: VirtualFile['typescript'];
	public linkedCodeMappings: Mapping<[LinkedCodeTrigger, LinkedCodeTrigger]>[] = [];

	constructor(
		public fileName: string,
		public content: Segment<CodeInformation>[],
		public contentStacks: StackNode[],
	) { }
}
