import type { LanguageServiceContext, LanguageServicePluginInstance, SourceScript } from '@volar/language-service';
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
			const info = resolveEmbeddedCode(context, document.uri);
			if (!info) {
				return;
			}

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
					fileName: info.root.fileName,
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
