import { FileMap, Language } from '@vue/language-core';
import * as fs from 'node:fs';
import * as net from 'node:net';
import type * as ts from 'typescript';
import { collectExtractProps } from './requests/collectExtractProps';
import { getComponentDirectives } from './requests/getComponentDirectives';
import { getComponentEvents } from './requests/getComponentEvents';
import { getComponentNames } from './requests/getComponentNames';
import { type ComponentPropInfo, getComponentProps } from './requests/getComponentProps';
import { getElementAttrs } from './requests/getElementAttrs';
import { getImportPathForFile } from './requests/getImportPathForFile';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from './requests/getQuickInfoAtPosition';
import type { RequestContext } from './requests/types';
import { getServerPath } from './utils';

export type RequestType =
	'containsFile'
	| 'projectInfo'
	| 'collectExtractProps'
	| 'getImportPathForFile'
	| 'getPropertiesAtLocation'
	| 'getQuickInfoAtPosition'
	// Component Infos
	| 'subscribeComponentProps'
	| 'getComponentEvents'
	| 'getComponentDirectives'
	| 'getElementAttrs';

export type NotificationType =
	'componentNamesUpdated'
	| 'componentPropsUpdated';

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
	type: NotificationType,
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
	const currentData = new FileMap<[
		componentNames: string[],
		Record<string, ComponentPropInfo[]>,
	]>(false);
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

		for (const [fileName, [componentNames, componentProps]] of currentData) {
			notify(connection, 'componentNamesUpdated', fileName, componentNames);

			for (const [name, props] of Object.entries(componentProps)) {
				notify(connection, 'componentPropsUpdated', fileName, [name, props]);
			}
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

				let data = currentData.get(scriptInfo.fileName);
				if (!data) {
					data = [[], {}];
					currentData.set(scriptInfo.fileName, data);
				}

				const [oldComponentNames, componentProps] = data;
				const newComponentNames = getComponentNames.apply(requestContext, [scriptInfo.fileName]) ?? [];

				if (JSON.stringify(oldComponentNames) !== JSON.stringify(newComponentNames)) {
					data[0] = newComponentNames;
					for (const connection of connections) {
						notify(connection, 'componentNamesUpdated', scriptInfo.fileName, newComponentNames);
					}
				}

				for (const [name, props] of Object.entries(componentProps)) {
					await sleep(10);
					if (token?.isCancellationRequested()) {
						break;
					}
					const newProps = getComponentProps.apply(requestContext, [scriptInfo.fileName, name]) ?? [];
					if (JSON.stringify(props) !== JSON.stringify(newProps)) {
						componentProps[name] = newProps;
						for (const connection of connections) {
							notify(connection, 'componentPropsUpdated', scriptInfo.fileName, [name, newProps]);
						}
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

	function handleRequest(requestType: RequestType, ...args: [fileName: string, ...any[]]) {
		const fileName = args[0];

		if (requestType === 'projectInfo') {
			return {
				name: info.project.getProjectName(),
				kind: info.project.projectKind,
				currentDirectory: info.project.getCurrentDirectory(),
			} satisfies ProjectInfo;
		}
		else if (requestType === 'containsFile') {
			return info.project.containsFile(ts.server.toNormalizedPath(fileName));
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
		else if (requestType === 'subscribeComponentProps') {
			const tag = args[1];
			const props = getComponentProps.apply(requestContext, [fileName, tag]) ?? [];
			let data = currentData.get(fileName);
			if (!data) {
				data = [[], {}];
				currentData.set(fileName, data);
			}
			data[1][tag] = props;
			return props;
		}
		else if (requestType === 'getComponentEvents') {
			return getComponentEvents.apply(requestContext, args as any);
		}
		else if (requestType === 'getComponentDirectives') {
			return getComponentDirectives.apply(requestContext, args as any);
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
