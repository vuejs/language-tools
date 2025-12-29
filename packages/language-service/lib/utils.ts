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
