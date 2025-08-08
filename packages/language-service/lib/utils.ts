import {
	type LanguageServiceContext,
	type LanguageServicePluginInstance,
	type SourceScript,
	type TextDocument,
} from '@volar/language-service';
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

export function createTsAliasDocumentLinksProviders(
	context: LanguageServiceContext,
	service: LanguageServicePluginInstance,
	filter: string | ((id: string) => boolean),
	resolveModuleName: import('@vue/typescript-plugin/lib/requests').Requests['resolveModuleName'],
): Pick<
	LanguageServicePluginInstance,
	'provideDocumentLinks' | 'resolveDocumentLink'
> {
	return {
		async provideDocumentLinks(document, token) {
			const info = getEmbeddedInfo(context, document, filter);
			if (!info) {
				return;
			}
			const { root } = info;

			const documentLinks = await service.provideDocumentLinks?.(document, token);

			for (const link of documentLinks ?? []) {
				if (!link.target) {
					continue;
				}
				let text = document.getText(link.range);
				if (text.startsWith('./') || text.startsWith('../')) {
					continue;
				}
				if (text.startsWith(`'`) || text.startsWith(`"`)) {
					text = text.slice(1, -1);
				}
				link.data = {
					fileName: root.fileName,
					text: text,
					originalTarget: link.target,
				};
				delete link.target;
			}

			return documentLinks;
		},

		async resolveDocumentLink(link) {
			const { fileName, text, originalTarget } = link.data;
			const { name } = await resolveModuleName(fileName, text) ?? {};

			return {
				...link,
				target: name ?? originalTarget,
			};
		},
	};
}
