import { launchServer } from '@typescript/server-harness';
import { ConfigurationRequest, PublishDiagnosticsNotification, TextDocument } from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { startLanguageServer } from '@volar/test-utils';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import { VueInitializationOptions } from '../lib/types';

let serverHandle: LanguageServerHandle | undefined;
let tsserver: import('@typescript/server-harness').Server;
let seq = 1;

export const testWorkspacePath = path.resolve(__dirname, '../../../test-workspace');

export async function getLanguageServer(): Promise<{
	vueserver: LanguageServerHandle;
	tsserver: import('@typescript/server-harness').Server;
	nextSeq: () => number;
	open: (uri: string, languageId: string, content: string) => Promise<TextDocument>;
	close: (uri: string) => Promise<void>;
}> {
	if (!serverHandle) {
		tsserver = launchServer(
			path.join(__dirname, '..', '..', '..', 'node_modules', 'typescript', 'lib', 'tsserver.js'),
			[
				'--disableAutomaticTypingAcquisition',
				'--globalPlugins', '@vue/typescript-plugin',
				'--suppressDiagnosticEvents',
				// '--logVerbosity', 'verbose',
				// '--logFile', path.join(__dirname, 'tsserver.log'),
			]
		);

		tsserver.on('exit', code => console.log(code ? `Exited with code ${code}` : `Terminated`));
		// tsserver.on('event', e => console.log(e));

		serverHandle = startLanguageServer(require.resolve('../bin/vue-language-server.js'), testWorkspacePath);
		serverHandle.connection.onNotification(PublishDiagnosticsNotification.type, () => { });
		serverHandle.connection.onRequest(ConfigurationRequest.type, ({ items }) => {
			return items.map(({ section }) => {
				if (section?.startsWith('vue.inlayHints.')) {
					return true;
				}
				return null;
			});
		});
		serverHandle.connection.onRequest('tsserverRequest', async ([command, args]) => {
			const res = await tsserver.message({
				seq: seq++,
				command: command,
				arguments: args,
			});
			return res.body;
		});

		await serverHandle.initialize(
			URI.file(testWorkspacePath).toString(),
			{
				typescript: {
					tsdk: path.dirname(require.resolve('typescript/lib/typescript.js')),
					tsserverRequestCommand: 'tsserverRequest',
				},
			} satisfies VueInitializationOptions,
			{
				workspace: {
					configuration: true,
				},
			}
		);
	}
	return {
		vueserver: serverHandle,
		tsserver: tsserver,
		nextSeq: () => seq++,
		open: async (uri: string, languageId: string, content: string) => {
			const res = await tsserver.message({
				seq: seq++,
				type: 'request',
				command: 'updateOpen',
				arguments: {
					changedFiles: [],
					closedFiles: [],
					openFiles: [
						{
							file: URI.parse(uri).fsPath,
							fileContent: content,
						}
					]
				}
			});
			if (!res.success) {
				throw new Error(res.body);
			}
			return await serverHandle!.openInMemoryDocument(uri, languageId, content);
		},
		close: async (uri: string) => {
			const res = await tsserver.message({
				seq: seq++,
				type: 'request',
				command: 'updateOpen',
				arguments: {
					changedFiles: [],
					closedFiles: [URI.parse(uri).fsPath],
					openFiles: []
				}
			});
			if (!res.success) {
				throw new Error(res.body);
			}
			await serverHandle!.closeTextDocument(uri);
		},
	};
}
