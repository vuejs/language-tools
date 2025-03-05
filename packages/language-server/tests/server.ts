import { launchServer } from '@typescript/server-harness';
import { ConfigurationRequest, PublishDiagnosticsNotification, TextDocument } from '@volar/language-server';
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
			path.join(__dirname, "..", "..", "..", "node_modules", "typescript", "lib", "tsserver.js"),
			// Arguments to tsserver.js
			[
				"--globalPlugins", "@vue/typescript-plugin",

				// ATA generates some extra network traffic and isn't usually relevant when profiling
				"--disableAutomaticTypingAcquisition",

				// Enable this if you're emulating VS
				"--suppressDiagnosticEvents",

				// // Produce a performance trace
				// "--traceDirectory", path.join(__dirname, "traces"),

				// // Produce a server log
				// "--logVerbosity", "verbose",
				// "--logFile", path.join(__dirname, "tsserver.log"),
			],
			// Arguments to node
			[
				// Enable this to debug the server process (not the driver process)
				// "--inspect-brk=9230",

				// Generate time and heap profiles (see https://github.com/jakebailey/pprof-it for config options)
				// Disable logging if profiling - their cleanup handlers conflict
				// Disable tracing if profiling - it causes unrealistic slowdowns
				// `--require=${path.join(__dirname, "node_modules", "pprof-it", "dist", "index.js")}`,

				// Increasing the heap size is just generally a good idea
				"--max-old-space-size=4096",

				// This will enable some GC output in the server log
				"--expose-gc"
			],
			// Environment variables for server process (mostly useful for pprof-it)
			{
				"PPROF_OUT": path.join(__dirname, "profiles")
			});

		tsserver.on("exit", code => console.log(code ? `Exited with code ${code}` : `Terminated`));
		tsserver.on("event", e => console.log(e));

		// Always start with a `configure` message (possibly preceded by `status` if emulating VS)
		await tsserver.message({
			seq: seq++,
			type: 'request',
			command: 'configure',
			arguments: {
				preferences: {
					includePackageJsonAutoImports: 'auto'
				},
				watchOptions: {
					excludeDirectories: ['**/node_modules']
				}
			}
		});

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
		serverHandle.connection.onRequest('executeTsserverCommand', (command, args) => {
			console.log('!!!', command);
			return tsserver.message({
				seq: seq++,
				type: 'request',
				command: command,
				arguments: args,
			});
		});

		await serverHandle.initialize(
			URI.file(testWorkspacePath).toString(),
			{
				typescript: {
					tsdk: path.dirname(require.resolve('typescript/lib/typescript.js')),
					serverProxyCommand: 'executeTsserverCommand',
				},
			},
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
				"seq": seq++,
				"type": "request",
				"command": "updateOpen",
				"arguments": {
					"changedFiles": [],
					"closedFiles": [],
					"openFiles": [
						{
							"file": URI.parse(uri).fsPath,
							"fileContent": content,
							"projectRootPath": path.resolve(testWorkspacePath, './tsconfigProject'),
							// "scriptKindName": "TS", // It's easy to get this wrong when copy-pasting
							"plugins": ["@vue/typescript-plugin"],
						}
					]
				}
			});
			if (!res.success) {
				throw new Error(res.body);
			}

			// Wait for the named pipe server ready
			// TODO: remove this when named pipe logic is removed
			await new Promise<void>(resolve => setTimeout(resolve, 2000));

			return await serverHandle!.openInMemoryDocument(uri, languageId, content);
		},
		close: async (uri: string) => {
			const res = await tsserver.message({
				"seq": seq++,
				"type": "request",
				"command": "updateOpen",
				"arguments": {
					"changedFiles": [],
					"closedFiles": [URI.parse(uri).fsPath],
					"openFiles": []
				}
			});
			if (!res.success) {
				throw new Error(res.body);
			}
			await serverHandle!.closeTextDocument(uri);
		},
	};
}
