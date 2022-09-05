import { LanguageConfigs, RuntimeEnvironment } from '../types';
import * as vue from '@volar/vue-language-service';
import { ConfigurationHost } from '@volar/vue-language-service';
import { URI } from 'vscode-uri';
import { loadCustomPlugins } from '../common';

export function createDocumentServiceHost(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	configHost: ConfigurationHost | undefined,
) {

	const workspaceServices = new Map<string, vue.DocumentService>();
	const untitledService = languageConfigs.getDocumentService(
		ts,
		configHost,
		runtimeEnv.fileSystemProvide,
		[],
		URI.from({ scheme: 'untitled' }),
	);

	return {
		add,
		remove,
		get,
	};

	function add(rootUri: URI) {
		workspaceServices.set(rootUri.toString(), languageConfigs.getDocumentService(
			ts,
			configHost,
			runtimeEnv.fileSystemProvide,
			loadCustomPlugins(rootUri.fsPath),
			rootUri,
		));
	}
	function remove(rootUri: URI) {
		workspaceServices.delete(rootUri.toString());
	}
	function get(documentUri: string) {
		for (const [rootUri, service] of workspaceServices) {
			if (documentUri.startsWith(rootUri)) {
				return service;
			}
		}
		return untitledService;
	}
}
