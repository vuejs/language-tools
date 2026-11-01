import type { LanguageServicePlugin, LanguageServicePluginInstance, TextDocument } from '@volar/language-service';
import { URI } from 'vscode-uri';
import { embeddedCodeIds } from '../virtualCode';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-format-per-block',
		capabilities: {
			documentFormattingProvider: true,
			documentOnTypeFormattingProvider: {
				triggerCharacters: [],
			},
		},
		create(context): LanguageServicePluginInstance {
			return {
				async provideDocumentFormattingEdits(document) {
					if (await shouldSkip(document)) {
						return [];
					}
					return undefined;
				},
				async provideOnTypeFormattingEdits(document) {
					if (await shouldSkip(document)) {
						return [];
					}
					return undefined;
				},
			};
			async function shouldSkip(document: TextDocument): Promise<boolean> {
				const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
				if (!decoded) {
					return false;
				}

				const [, embeddedCodeId] = decoded;

				if (embeddedCodeId === embeddedCodeIds.scriptRaw || embeddedCodeId === embeddedCodeIds.scriptSetupRaw) {
					return await context.env.getConfiguration<boolean>?.('vue.format.script.enabled') === false;
				}
				if (embeddedCodeId.startsWith(embeddedCodeIds.stylePrefix)) {
					return await context.env.getConfiguration<boolean>?.('vue.format.style.enabled') === false;
				}
				if (
					embeddedCodeId === embeddedCodeIds.template
					|| embeddedCodeId.startsWith(embeddedCodeIds.templateInlineTsPrefix)
					|| embeddedCodeId === embeddedCodeIds.rootTags
				) {
					return await context.env.getConfiguration<boolean>?.('vue.format.template.enabled') === false;
				}

				return false;
			}
		},
	};
}
