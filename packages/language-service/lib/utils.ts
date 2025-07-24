import { type LanguageServiceContext, type SourceScript, type TextDocument } from '@volar/language-service';
import { VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

export function getEmbeddedInfo(
	context: LanguageServiceContext,
	document: TextDocument,
	embeddedCodeId?: string | ((id: string) => boolean),
	languageId?: string,
) {
	const uri = URI.parse(document.uri);
	const decoded = context.decodeEmbeddedDocumentUri(uri);
	if (!decoded) {
		return;
	}

	if (embeddedCodeId) {
		if (typeof embeddedCodeId === 'string') {
			if (decoded[1] !== embeddedCodeId) {
				return;
			}
		}
		else if (!embeddedCodeId(decoded[1])) {
			return;
		}
	}

	if (languageId && document.languageId !== languageId) {
		return;
	}

	const sourceScript = context.language.scripts.get(decoded[0]);
	if (!sourceScript?.generated) {
		return;
	}

	const virtualCode = sourceScript.generated.embeddedCodes.get(decoded[1]);
	if (!virtualCode) {
		return;
	}

	const root = sourceScript.generated.root;
	if (!(root instanceof VueVirtualCode)) {
		return;
	}

	return {
		sourceScript: sourceScript as Required<SourceScript<URI>>,
		virtualCode,
		root,
	};
}
