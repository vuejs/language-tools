import type { LanguageServicePlugin } from '@volar/language-service';
import { resolveEmbeddedCode } from '../utils';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-component-references',
		capabilities: {
			definitionProvider: true,
		},
		create(context) {
			return {
				provideDefinition(document, position) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'main') {
						return;
					}

					const { template } = info.root.sfc;
					if (!template) {
						return;
					}

					const offset = document.offsetAt(position);
					const start = template.start + 1;
					const end = start + 'template'.length;
					if (offset >= start && offset <= end) {
						return [{
							targetUri: document.uri,
							targetRange: {
								start: document.positionAt(template.start),
								end: document.positionAt(template.end),
							},
							targetSelectionRange: {
								start: document.positionAt(start),
								end: document.positionAt(end),
							},
						}];
					}
				},
			};
		},
	};
}
