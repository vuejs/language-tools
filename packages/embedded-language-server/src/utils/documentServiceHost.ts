import { LanguageConfigs, RuntimeEnvironment } from '../types';
import * as vue from '@volar/vue-language-service';
import { ConfigurationHost } from '@volar/vue-language-service';
import { URI } from 'vscode-uri';
import { loadCustomPlugins } from './config';

// fix build
import type * as _ from 'vscode-languageserver-textdocument';

export function createDocumentServiceHost(
	runtimeEnv: RuntimeEnvironment,
	languageConfigs: LanguageConfigs,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	configHost: ConfigurationHost | undefined,
) {

	const workspaceServices = new Map<string, vue.DocumentService>();
	const untitledService = languageConfigs.getDocumentService(
		ts,
		{
			rootUri: URI.from({ scheme: 'untitled' }),
			configurationHost: configHost,
			fileSystemProvider: runtimeEnv.fileSystemProvide,
		},
		[],
	);

	return {
		add,
		remove,
		get,
	};

	function add(rootUri: URI) {
		workspaceServices.set(rootUri.toString(), languageConfigs.getDocumentService(
			ts,
			{
				rootUri,
				configurationHost: configHost,
				fileSystemProvider: runtimeEnv.fileSystemProvide,
			},
			loadCustomPlugins(rootUri.fsPath),
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
