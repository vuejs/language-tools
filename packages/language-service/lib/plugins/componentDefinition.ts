import type { LanguageServicePlugin } from '@volar/language-service';
import { URI } from 'vscode-uri';
import { embeddedCodeIds } from '../virtualCode';
import { getComponentTagAt, resolveEmbeddedCode } from '../virtualCodeQueries';

/**
 * Leads a component tag to the declaration of the component in another file, e.g. the Vue file of a global
 * component, where the TypeScript language server stops at its registration.
 */
export function create(
	{ getComponentDefinition }: import('../requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-component-definition',
		capabilities: {
			definitionProvider: true,
		},
		create(context) {
			return {
				async provideDefinition(document, position) {
					const info = resolveEmbeddedCode(context, document.uri);
					const template = info?.root.ir.template;
					if (info?.code.id !== embeddedCodeIds.template || !template) {
						return;
					}
					const tag = getComponentTagAt(template, document.offsetAt(position));
					const definition = tag && await getComponentDefinition(info.root.fileName, tag.element.loc.start.offset);
					if (!tag || !definition) {
						return;
					}
					return [{
						originSelectionRange: {
							start: document.positionAt(tag.start),
							end: document.positionAt(tag.end),
						},
						targetUri: URI.file(definition.fileName).toString(),
						targetRange: definition.range,
						targetSelectionRange: definition.range,
					}];
				},
			};
		},
	};
}
