import * as Proto from 'typescript/lib/tsserverlibrary';
export = Proto.server.protocol;

declare enum ServerType {
	Syntax = 'syntax',
	Semantic = 'semantic',
}
declare module 'typescript/lib/tsserverlibrary' {

	interface Response {
		readonly _serverType?: ServerType;
	}

	interface JSDocLinkDisplayPart {
		target: Proto.server.protocol.FileSpan;
	}
}

