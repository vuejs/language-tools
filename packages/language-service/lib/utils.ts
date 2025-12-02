import type { LanguageServiceContext, SourceScript } from '@volar/language-service';
import type { VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

export function resolveEmbeddedCode(
	context: LanguageServiceContext,
	uriStr: string,
) {
	const uri = URI.parse(uriStr);
	const decoded = context.decodeEmbeddedDocumentUri(uri);
	if (!decoded) {
		return;
	}
	const sourceScript = context.language.scripts.get(decoded[0])!;
	const code = sourceScript.generated!.embeddedCodes.get(decoded[1])!;
	return {
		script: sourceScript as Required<SourceScript<URI>>,
		code,
		root: sourceScript.generated!.root as VueVirtualCode,
	};
}

export function createReferenceResolver(
	context: LanguageServiceContext,
	resolveReference: typeof import('volar-service-html').resolveReference,
	resolveModuleName: import('@vue/typescript-plugin/lib/requests').Requests['resolveModuleName'],
) {
	return async (ref: string, base: string) => {
		let uri = URI.parse(base);
		const decoded = context.decodeEmbeddedDocumentUri(uri);
		if (decoded) {
			uri = decoded[0];
		}

		let moduleName: string | null | undefined;
		if (!ref.startsWith('./') && !ref.startsWith('../')) {
			moduleName = await resolveModuleName(uri.fsPath, ref);
		}
		return moduleName ?? resolveReference(ref, uri, context.env.workspaceFolders);
	};
}
