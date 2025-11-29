import type { LanguageServicePlugin, LanguageServicePluginInstance, TextDocument } from '@volar/language-service';
import { URI } from 'vscode-uri';

export interface FormatTakeOverConfig {
	root?: boolean;
	script?: boolean;
	template?: boolean;
	style?: boolean;
}

const defaultOptions: Required<FormatTakeOverConfig> = {
	root: true,
	script: true,
	template: true,
	style: true,
};

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-format-takeover',
		capabilities: {
			documentFormattingProvider: true,
			documentOnTypeFormattingProvider: {
				triggerCharacters: [],
			},
		},
		create(context): LanguageServicePluginInstance {
			const getOptions = async () => ({
				...defaultOptions,
				...(await context.env.getConfiguration<FormatTakeOverConfig>?.('vue.format.takeOver') ?? {}),
			});

			async function shouldSkip(document: TextDocument): Promise<boolean> {
				const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
				if (!decoded) {
					return false;
				}

				const [, embeddedCodeId] = decoded;
				const options = await getOptions();

				if (embeddedCodeId.startsWith('template') || embeddedCodeId.startsWith('root')) {
					return !options.template;
				}
				if (embeddedCodeId.startsWith('script')) {
					return !options.script;
				}
				if (embeddedCodeId.startsWith('style')) {
					return !options.style;
				}

				return false;
			}

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
		},
	};
}
