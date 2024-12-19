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

export type RequestData = [
	seq: number,
	type: 'containsFile'
	| 'projectInfo'
	| 'collectExtractProps'
	| 'getImportPathForFile'
	| 'getPropertiesAtLocation'
	| 'getQuickInfoAtPosition'
	// Component Infos
	| 'getComponentProps'
	| 'getComponentEvents'
	| 'getTemplateContextProps'
	| 'getComponentNames'
	| 'getElementAttrs',
	fileName: string,
	...args: any[],
];

export type ResponseData = [
	seq: number,
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
	const dataChunks: Buffer[] = [];
	const server = net.createServer(connection => {
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
						const [seq, requestType, ...args]: RequestData = JSON.parse(json);
						const requestContext: RequestContext = {
							typescript: ts,
							languageService: info.languageService,
							languageServiceHost: info.languageServiceHost,
							language: language,
							isTsPlugin: true,
							getFileId: (fileName: string) => fileName,
						};
						if (requestType === 'projectInfo') {
							sendResponse({
								name: info.project.getProjectName(),
								kind: info.project.projectKind,
								currentDirectory: info.project.getCurrentDirectory(),
							} satisfies ProjectInfo);
						}
						else if (requestType === 'containsFile') {
							sendResponse(
								info.project.containsFile(ts.server.toNormalizedPath(args[0]))
							);
						}
						else if (requestType === 'collectExtractProps') {
							const result = collectExtractProps.apply(requestContext, args as any);
							sendResponse(result);
						}
						else if (requestType === 'getImportPathForFile') {
							const result = getImportPathForFile.apply(requestContext, args as any);
							sendResponse(result);
						}
						else if (requestType === 'getPropertiesAtLocation') {
							const result = getPropertiesAtLocation.apply(requestContext, args as any);
							sendResponse(result);
						}
						else if (requestType === 'getQuickInfoAtPosition') {
							const result = getQuickInfoAtPosition.apply(requestContext, args as any);
							sendResponse(result);
						}
						// Component Infos
						else if (requestType === 'getComponentProps') {
							const result = getComponentProps.apply(requestContext, args as any);
							sendResponse(result);
						}
						else if (requestType === 'getComponentEvents') {
							const result = getComponentEvents.apply(requestContext, args as any);
							sendResponse(result);
						}
						else if (requestType === 'getTemplateContextProps') {
							const result = getTemplateContextProps.apply(requestContext, args as any);
							sendResponse(result);
						}
						else if (requestType === 'getComponentNames') {
							const result = getComponentNames.apply(requestContext, args as any);
							sendResponse(result);
						}
						else if (requestType === 'getElementAttrs') {
							const result = getElementAttrs.apply(requestContext, args as any);
							sendResponse(result);
						}
						else {
							console.warn('[Vue Named Pipe Server] Unknown request:', json);
							debugger;
						}

						function sendResponse(data: any | undefined) {
							connection.write(JSON.stringify([seq, data ?? null]) + '\n\n');
						}
					} catch (e) {
						console.error('[Vue Named Pipe Server] JSON parse error:', e);
					}
				}
			}
		});
		connection.on('error', err => console.error('[Vue Named Pipe Server]', err.message));
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
