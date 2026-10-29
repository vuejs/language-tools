import {
	ConfigurationRequest,
	type FileEvent,
	type InitializeResult,
	PublishDiagnosticsNotification,
	type Range,
	type TextDocument,
} from '@volar/language-server';
import type { LanguageServerHandle } from '@volar/test-utils';
import { startLanguageServer } from '@volar/test-utils';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import { type LspServer, startLspServer } from '../../content-mapper/tests/lsp';
import { typescriptPackageJsonPath } from '../../content-mapper/tests/utils';

export { typescriptPackageJsonPath };

const vueServers = new Map<string, Promise<{ handle: LanguageServerHandle; initializeResult: InitializeResult }>>();
let typescriptServer: Promise<LspServer> | undefined;
const typescriptServerVersions = new Map<string, number>();

export const testWorkspacePath = path.resolve(__dirname, '../../../test-workspace');

type LocationLike = { uri: string; range: Range } | { targetUri: string; targetSelectionRange: Range };

/** `file:line:character-line:character` (zero-based, relative to the test workspace) for each LSP location. */
export function formatLocations(locations: LocationLike | readonly LocationLike[] | null | undefined) {
	return (Array.isArray(locations) ? locations : locations ? [locations] : []).map((location: LocationLike) => {
		const [uri, { start, end }] = 'uri' in location
			? [location.uri, location.range]
			: [location.targetUri, location.targetSelectionRange];
		const file = path.relative(testWorkspacePath, URI.parse(uri).fsPath).replace(/\\/g, '/');
		return `${file}:${start.line}:${start.character}-${end.line}:${end.character}`;
	}).sort();
}

/** @param serverModule The entry module of the Vue language server; the TypeScript language server is shared. */
export async function getLanguageServer(serverModule = require.resolve('../index.js')): Promise<{
	vueserver: LanguageServerHandle;
	initializeResult: InitializeResult;
	/** Sends a request to the TypeScript 7 language server that serves the opened documents. */
	typescript: <T = any>(method: string, params: unknown) => Promise<T>;
	open: (uri: string, languageId: string, content: string) => Promise<TextDocument>;
	close: (uri: string) => Promise<void>;
	/** What an editor's file watcher reports to its TypeScript language server after files change on disk. */
	changeWatchedFiles: (changes: FileEvent[]) => Promise<void>;
}> {
	let vueServer = vueServers.get(serverModule);
	if (!vueServer) {
		vueServers.set(serverModule, vueServer = startVueServer(serverModule));
	}
	const { handle: serverHandle, initializeResult } = await vueServer;
	return {
		vueserver: serverHandle,
		initializeResult,
		typescript: async (method, params) =>
			(await (typescriptServer ??= startLspServer(testWorkspacePath))).request(method, params),
		open: async (uri, languageId, content) => {
			if (uri.startsWith('file://')) {
				// What an editor does for its TypeScript language server, which the Vue language server's API session reads from.
				const server = await (typescriptServer ??= startLspServer(testWorkspacePath));
				const version = (typescriptServerVersions.get(uri) ?? 0) + 1;
				if (version === 1) {
					server.notify('textDocument/didOpen', { textDocument: { uri, languageId, version, text: content } });
				}
				else {
					server.notify('textDocument/didChange', {
						textDocument: { uri, version },
						contentChanges: [{ text: content }],
					});
				}
				typescriptServerVersions.set(uri, version);
				// a round trip on the same connection guarantees the notification was read before the API is asked
				await server.request('vue/sync', {}).catch(() => {});
			}
			return await serverHandle.openInMemoryDocument(uri, languageId, content);
		},
		close: async uri => {
			if (uri.startsWith('file://')) {
				if (typescriptServerVersions.delete(uri)) {
					(await typescriptServer!).notify('textDocument/didClose', { textDocument: { uri } });
				}
			}
			await serverHandle.closeTextDocument(uri);
		},
		changeWatchedFiles: async changes => {
			const server = await (typescriptServer ??= startLspServer(testWorkspacePath));
			server.notify('workspace/didChangeWatchedFiles', { changes });
			// a round trip on the same connection guarantees the notification was read before the next request
			await server.request('vue/sync', {}).catch(() => {});
		},
	};
}

async function startVueServer(serverModule: string) {
	const serverHandle = startLanguageServer(serverModule, testWorkspacePath);
	serverHandle.connection.onNotification(PublishDiagnosticsNotification.type, () => {});
	serverHandle.connection.onRequest(ConfigurationRequest.type, ({ items }) => {
		return items.map(({ section }) => {
			if (
				section?.startsWith('vue.inlayHints.')
				|| section === 'vue.hover.rich'
				|| section === 'vue.autoInsert.dotValue'
			) {
				return true;
			}
			return null;
		});
	});
	// What an editor does for the Vue language server: forward the request to its TypeScript language server.
	serverHandle.connection.onRequest('vue/typescriptApiConnection', async () => {
		const server = await (typescriptServer ??= startLspServer(testWorkspacePath));
		const { pipe } = await server.request<{ pipe: string }>('custom/initializeAPISession', {});
		return { pipe, packageJsonPath: typescriptPackageJsonPath };
	});
	const initializeResult = await serverHandle.initialize(
		URI.file(testWorkspacePath).toString(),
		// What the VS Code client registers for files outside any tsconfig
		{ contentMappers: [{ package: '@vue/content-mapper', extensions: ['.vue'] }] },
		{
			workspace: {
				configuration: true,
				didChangeWatchedFiles: {},
			},
		},
	);
	return { handle: serverHandle, initializeResult };
}
