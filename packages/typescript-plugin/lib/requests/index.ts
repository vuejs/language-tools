import type * as ts from 'typescript';

type ToRequest<T extends (...args: any) => any> = (...args: Parameters<T>) => Promise<ReturnType<T> | null | undefined>;

export type Requests = {
	collectExtractProps: ToRequest<typeof import('./collectExtractProps.js')['collectExtractProps']>;
	getImportPathForFile: ToRequest<typeof import('./getImportPathForFile.js')['getImportPathForFile']>;
	getPropertiesAtLocation: ToRequest<typeof import('./getPropertiesAtLocation.js')['getPropertiesAtLocation']>;
	getComponentDirectives: ToRequest<typeof import('./getComponentDirectives.js')['getComponentDirectives']>;
	getComponentEvents: ToRequest<typeof import('./getComponentEvents.js')['getComponentEvents']>;
	getComponentNames: ToRequest<typeof import('./getComponentNames.js')['getComponentNames']>;
	getComponentProps: ToRequest<typeof import('./getComponentProps.js')['getComponentProps']>;
	getComponentSlots: ToRequest<typeof import('./getComponentSlots.js')['getComponentSlots']>;
	getElementAttrs: ToRequest<typeof import('./getElementAttrs.js')['getElementAttrs']>;
	getElementNames: ToRequest<typeof import('./getElementNames.js')['getElementNames']>;
	getEncodedSemanticClassifications: ToRequest<(fileName: string, span: ts.TextSpan) => ts.Classifications>;
	getQuickInfoAtPosition: ToRequest<(fileName: string, position: ts.LineAndCharacter) => string>;
};
