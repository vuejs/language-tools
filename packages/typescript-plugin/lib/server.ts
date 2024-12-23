import type { Language } from '@vue/language-core';
import * as fs from 'node:fs';
import * as net from 'node:net';
import type * as ts from 'typescript';
import { collectExtractProps } from './requests/collectExtractProps';
import { getComponentEvents, getComponentNames, getComponentProps, getElementAttrs, getTemplateContextProps } from './requests/componentInfos';
import { getImportPathForFile } from './requests/getImportPathForFile';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from './requests/getQuickInfoAtPosition';
import type { RequestContext } from './requests/types';
import { getServerPath } from './utils';

export type RequestType = 'containsFile'
	| 'projectInfo'
	| 'collectExtractProps'
	| 'getImportPathForFile'
	| 'getPropertiesAtLocation'
	| 'getQuickInfoAtPosition'
	// Component Infos
	| 'getComponentProps'
	| 'getComponentEvents'
	| 'getTemplateContextProps'
	| 'getElementAttrs';

export type RequestData = [
	seq: number,
	type: RequestType,
	fileName: string,
	...args: any[],
];

export type ResponseData = [
	seq: number,
	data: any,
];

export type NotificationData = [
	type: 'componentAndPropsUpdated',
	fileName: string,
	data: any,
];

export interface ProjectInfo {
	name: string;
	kind: ts.server.ProjectKind;
	currentDirectory: string;
}

export async function startNamedPipeServer(
	ts: typeof import('typescript'),
	info: ts.server.PluginCreateInfo,
	language: Language<string>,
	projectKind: ts.server.ProjectKind.Inferred | ts.server.ProjectKind.Configured
) {
	let lastProjectVersion: string | undefined;

	const requestContext: RequestContext = {
		typescript: ts,
		languageService: info.languageService,
		languageServiceHost: info.languageServiceHost,
		language: language,
		isTsPlugin: true,
		getFileId: (fileName: string) => fileName,
	};
	const dataChunks: Buffer[] = [];
	const componentNamesAndProps = new Map<string, string>();
	const allConnections = new Set<net.Socket>();
	const pendingRequests = new Set<number>();
	const server = net.createServer(connection => {
		allConnections.add(connection);

		connection.on('end', () => {
			allConnections.delete(connection);
		});
		connection.on('data', buffer => {
			dataChunks.push(buffer);
			const text = dataChunks.toString();
			if (text.endsWith('\n\n')) {
				dataChunks.length = 0;
				const requests = text.split('\n\n');
				for (let json of requests) {
					json = json.trim();
					if (!json) {
						continue;
					}
					try {
						onRequest(connection, JSON.parse(json));
					} catch (e) {
						console.error('[Vue Named Pipe Server] JSON parse error:', e);
					}
				}
			}
		});
		connection.on('error', err => console.error('[Vue Named Pipe Server]', err.message));

		for (const [fileName, data] of componentNamesAndProps) {
			notify(connection, 'componentAndPropsUpdated', fileName, data);
		}
	});

	for (let i = 0; i < 10; i++) {
		const path = getServerPath(projectKind, i);
		const socket = await connect(path, 100);
		if (typeof socket === 'object') {
			socket.end();
		}
		const namedPipeOccupied = typeof socket === 'object' || socket === 'timeout';
		if (namedPipeOccupied) {
			continue;
		}
		const success = await tryListen(server, path);
		if (success) {
			break;
		}
	}

	updateWhile();

	async function updateWhile() {
		while (true) {
			await sleep(500);
			const projectVersion = info.project.getProjectVersion();
			if (lastProjectVersion === projectVersion) {
				continue;
			}
			const connections = [...allConnections].filter(c => !c.destroyed);
			if (!connections.length) {
				continue;
			}
			const token = info.languageServiceHost.getCancellationToken?.();
			const openedScriptInfos = info.project.getRootScriptInfos().filter(info => info.isScriptOpen());
			if (!openedScriptInfos.length) {
				continue;
			}
			for (const scriptInfo of openedScriptInfos) {
				await sleep(10);
				if (token?.isCancellationRequested()) {
					break;
				}
				let newData: Record<string, {
					name: string;
					required?: true;
					commentMarkdown?: string;
				}[]> | undefined = {};
				const componentNames = getComponentNames.apply(requestContext, [scriptInfo.fileName]);
				// const testProps = getComponentProps.apply(requestContext, [scriptInfo.fileName, 'HelloWorld']);
				// debugger;
				for (const component of componentNames ?? []) {
					await sleep(10);
					if (token?.isCancellationRequested()) {
						newData = undefined;
						break;
					}
					const props = getComponentProps.apply(requestContext, [scriptInfo.fileName, component]);
					if (props) {
						newData[component] = props;
					}
				}
				if (!newData) {
					// Canceled
					break;
				}
				const oldDataJson = componentNamesAndProps.get(scriptInfo.fileName);
				const newDataJson = JSON.stringify(newData);
				if (oldDataJson !== newDataJson) {
					// Update cache
					componentNamesAndProps.set(scriptInfo.fileName, newDataJson);
					// Notify
					for (const connection of connections) {
						notify(connection, 'componentAndPropsUpdated', scriptInfo.fileName, newData);
					}
				}
			}
			lastProjectVersion = projectVersion;
		}
	}

	function sleep(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	function notify(connection: net.Socket, type: NotificationData[0], fileName: string, data: any) {
		connection.write(JSON.stringify([type, fileName, data] satisfies NotificationData) + '\n\n');
	}

	function onRequest(connection: net.Socket, [seq, requestType, ...args]: RequestData) {
		if (pendingRequests.has(seq)) {
			return;
		}
		setTimeout(() => pendingRequests.delete(seq), 500);
		pendingRequests.add(seq);

		let data: any;
		try {
			data = handleRequest(requestType, ...args);
		} catch {
			data = null;
		}

		connection.write(JSON.stringify([seq, data ?? null]) + '\n\n');
	}

	function handleRequest(requestType: RequestType, ...args: any[]) {
		if (requestType === 'projectInfo') {
			return {
				name: info.project.getProjectName(),
				kind: info.project.projectKind,
				currentDirectory: info.project.getCurrentDirectory(),
			} satisfies ProjectInfo;
		}
		else if (requestType === 'containsFile') {
			return info.project.containsFile(ts.server.toNormalizedPath(args[0]));
		}
		else if (requestType === 'collectExtractProps') {
			return collectExtractProps.apply(requestContext, args as any);
		}
		else if (requestType === 'getImportPathForFile') {
			return getImportPathForFile.apply(requestContext, args as any);
		}
		else if (requestType === 'getPropertiesAtLocation') {
			return getPropertiesAtLocation.apply(requestContext, args as any);
		}
		else if (requestType === 'getQuickInfoAtPosition') {
			return getQuickInfoAtPosition.apply(requestContext, args as any);
		}
		else if (requestType === 'getComponentProps') {
			return getComponentProps.apply(requestContext, args as any);
		}
		else if (requestType === 'getComponentEvents') {
			return getComponentEvents.apply(requestContext, args as any);
		}
		else if (requestType === 'getTemplateContextProps') {
			return getTemplateContextProps.apply(requestContext, args as any);
		}
		else if (requestType === 'getElementAttrs') {
			return getElementAttrs.apply(requestContext, args as any);
		}

		console.warn('[Vue Named Pipe Server] Unknown request:', requestType);
		debugger;
		return undefined;
	}
}

function connect(namedPipePath: string, timeout?: number) {
	return new Promise<net.Socket | 'error' | 'timeout'>(resolve => {
		const socket = net.connect(namedPipePath);
		if (timeout) {
			socket.setTimeout(timeout);
		}
		const onConnect = () => {
			cleanup();
			resolve(socket);
		};
		const onError = (err: any) => {
			if (err.code === 'ECONNREFUSED') {
				try {
					console.log('[Vue Named Pipe Client] Deleting:', namedPipePath);
					fs.promises.unlink(namedPipePath);
				} catch { }
			}
			cleanup();
			resolve('error');
			socket.end();
		};
		const onTimeout = () => {
			cleanup();
			resolve('timeout');
			socket.end();
		};
		const cleanup = () => {
			socket.off('connect', onConnect);
			socket.off('error', onError);
			socket.off('timeout', onTimeout);
		};
		socket.on('connect', onConnect);
		socket.on('error', onError);
		socket.on('timeout', onTimeout);
	});
}

function tryListen(server: net.Server, namedPipePath: string) {
	return new Promise<boolean>(resolve => {
		const onSuccess = () => {
			server.off('error', onError);
			resolve(true);
		};
		const onError = (err: any) => {
			if (err.code === 'ECONNREFUSED') {
				try {
					console.log('[Vue Named Pipe Client] Deleting:', namedPipePath);
					fs.promises.unlink(namedPipePath);
				} catch { }
			}
			server.off('error', onError);
			server.close();
			resolve(false);
		};
		server.listen(namedPipePath, onSuccess);
		server.on('error', onError);
	});
}
