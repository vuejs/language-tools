import type * as ts from 'typescript';

type Request<T extends (...args: any) => any> = (
	...args: Parameters<T>
) => MaybePromise<ReturnType<T> | null | undefined>;
type MaybePromise<T> = T | Promise<T>;

export interface Requests {
	collectExtractProps: Request<typeof import('./collectExtractProps.js')['collectExtractProps']>;
	getImportPathForFile: Request<typeof import('./getImportPathForFile.js')['getImportPathForFile']>;
	getPropertiesAtLocation: Request<typeof import('./getPropertiesAtLocation.js')['getPropertiesAtLocation']>;
	getComponentDirectives: Request<typeof import('./getComponentDirectives.js')['getComponentDirectives']>;
	getComponentEvents: Request<typeof import('./getComponentEvents.js')['getComponentEvents']>;
	getComponentNames: Request<typeof import('./getComponentNames.js')['getComponentNames']>;
	getComponentProps: Request<typeof import('./getComponentProps.js')['getComponentProps']>;
	getComponentSlots: Request<typeof import('./getComponentSlots.js')['getComponentSlots']>;
	getElementAttrs: Request<typeof import('./getElementAttrs.js')['getElementAttrs']>;
	getElementNames: Request<typeof import('./getElementNames.js')['getElementNames']>;
	resolveModuleName: Request<typeof import('./resolveModuleName.js')['resolveModuleName']>;
	getDocumentHighlights: Request<(fileName: string, position: number) => ts.DocumentHighlights[]>;
	getEncodedSemanticClassifications: Request<(fileName: string, span: ts.TextSpan) => ts.Classifications>;
	getQuickInfoAtPosition: Request<(fileName: string, position: ts.LineAndCharacter) => string>;
}
