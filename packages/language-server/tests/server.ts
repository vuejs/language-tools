import { launchServer } from '@typescript/server-harness';
import { ConfigurationRequest, PublishDiagnosticsNotification, type TextDocument } from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { startLanguageServer } from '@volar/test-utils';
import * as path from 'node:path';
import { URI } from 'vscode-uri';

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
				'--globalPlugins',
				'@vue/typescript-plugin',
				'--suppressDiagnosticEvents',
				// '--logVerbosity', 'verbose',
				// '--logFile', path.join(__dirname, 'tsserver.log'),
			],
		);

		tsserver.on('exit', code => console.log(code ? `Exited with code ${code}` : `Terminated`));
		// tsserver.on('event', e => console.log(e));

		serverHandle = startLanguageServer(require.resolve('../index.js'), testWorkspacePath);
		serverHandle.connection.onNotification(PublishDiagnosticsNotification.type, () => {});
		serverHandle.connection.onRequest(ConfigurationRequest.type, ({ items }) => {
			return items.map(({ section }) => {
				if (section?.startsWith('vue.inlayHints.')) {
					return true;
				}
				return null;
			});
		});
		serverHandle.connection.onNotification('tsserver/request', ([id, command, args]) => {
			tsserver.message({
				seq: seq++,
				command: command,
				arguments: args,
			}).then(
				res => serverHandle!.connection.sendNotification('tsserver/response', [id, res?.body]),
				() => serverHandle!.connection.sendNotification('tsserver/response', [id, undefined]),
			);
		});

		await serverHandle.initialize(
			URI.file(testWorkspacePath).toString(),
			{},
			{
				workspace: {
					configuration: true,
				},
			},
		);
	}
	return {
		vueserver: serverHandle,
		tsserver: tsserver,
		nextSeq: () => seq++,
		open: async (uri, languageId, content) => {
			if (uri.startsWith('file://')) {
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
							},
						],
					},
				});
				if (!res.success) {
					throw new Error(res.body);
				}
			}
			return await serverHandle!.openInMemoryDocument(uri, languageId, content);
		},
		close: async uri => {
			if (uri.startsWith('file://')) {
				const res = await tsserver.message({
					seq: seq++,
					type: 'request',
					command: 'updateOpen',
					arguments: {
						changedFiles: [],
						closedFiles: [URI.parse(uri).fsPath],
						openFiles: [],
					},
				});
				if (!res.success) {
					throw new Error(res.body);
				}
			}
			await serverHandle!.closeTextDocument(uri);
		},
	};
}
