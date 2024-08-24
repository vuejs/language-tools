import * as path from 'path';
import type { LanguageServerHandle } from '@volar/test-utils';
import { startLanguageServer } from '@volar/test-utils';
import { URI } from 'vscode-uri';

let serverHandle: LanguageServerHandle | undefined;

export const testWorkspacePath = path.resolve(__dirname, '../../../test-workspace');

export async function getLanguageServer() {
	if (!serverHandle) {
		serverHandle = startLanguageServer(require.resolve('../bin/vue-language-server.js'), testWorkspacePath);
		serverHandle.connection.onNotification('textDocument/publishDiagnostics', () => { });

		await serverHandle.initialize(
			URI.file(testWorkspacePath).toString(),
			{
				typescript: {
					tsdk: path.dirname(require.resolve('typescript/lib/typescript.js')),
					disableAutoImportCache: true,
				},
				vue: {
					hybridMode: false,
				},
			}
		);
	}
	return serverHandle;
}
