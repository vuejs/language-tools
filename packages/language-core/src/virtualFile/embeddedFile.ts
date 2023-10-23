import { FileCapabilities, FileKind, FileRangeCapabilities, MirrorBehaviorCapabilities } from '@volar/language-core';
import { Mapping, Segment, StackNode } from '@volar/source-map';

export class VueEmbeddedFile {

	public parentFileName?: string;
	public kind = FileKind.TextFile;
	public capabilities: FileCapabilities = {};
	public mirrorBehaviorMappings: Mapping<[MirrorBehaviorCapabilities, MirrorBehaviorCapabilities]>[] = [];

	constructor(
		public fileName: string,
		public content: Segment<FileRangeCapabilities>[],
		public contentStacks: StackNode[],
	) { }
}
