import type { Language, VueCompilerOptions } from '@vue/language-core';
import * as fs from 'fs';
import * as net from 'net';
import type * as ts from 'typescript';
import { collectExtractProps } from './requests/collectExtractProps';
import { getComponentEvents, getComponentNames, getComponentProps, getElementAttrs, getTemplateContextProps } from './requests/componentInfos';
import { getImportPathForFile } from './requests/getImportPathForFile';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from './requests/getQuickInfoAtPosition';
import type { RequestContext } from './requests/types';
import { NamedPipeServer, connect, readPipeTable, updatePipeTable } from './utils';

export interface Request {
	type: 'projectInfoForFile'
	| 'collectExtractProps'
	| 'getImportPathForFile'
	| 'getPropertiesAtLocation'
	| 'getQuickInfoAtPosition'
	// Component Infos
	| 'getComponentProps'
	| 'getComponentEvents'
	| 'getTemplateContextProps'
	| 'getComponentNames'
	| 'getElementAttrs';
	args: [fileName: string, ...rest: any];
}

let started = false;

export function startNamedPipeServer(
	ts: typeof import('typescript'),
	serverKind: ts.server.ProjectKind,
	currentDirectory: string,
) {
	if (started) {
		return;
	}
	started = true;

	const pipeFile = process.platform === 'win32'
		? `\\\\.\\pipe\\vue-tsp-${process.pid}`
		: `/tmp/vue-tsp-${process.pid}`;
	const server = net.createServer(connection => {
		connection.on('data', data => {
			const text = data.toString();
			const request: Request = JSON.parse(text);
			const fileName = request.args[0];
			const project = getProject(ts.server.toNormalizedPath(fileName));
			if (request.type === 'projectInfoForFile') {
				connection.write(
					JSON.stringify(
						project
							? {
								name: project.info.project.getProjectName(),
								kind: project.info.project.projectKind,
							}
							: null
					)
				);
			}
			else if (project) {
				const requestContext: RequestContext = {
					typescript: ts,
					languageService: project.info.languageService,
					languageServiceHost: project.info.languageServiceHost,
					language: project.language,
					isTsPlugin: true,
					getFileId: (fileName: string) => fileName,
				};
				if (request.type === 'collectExtractProps') {
					const result = collectExtractProps.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				else if (request.type === 'getImportPathForFile') {
					const result = getImportPathForFile.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				else if (request.type === 'getPropertiesAtLocation') {
					const result = getPropertiesAtLocation.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				else if (request.type === 'getQuickInfoAtPosition') {
					const result = getQuickInfoAtPosition.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				// Component Infos
				else if (request.type === 'getComponentProps') {
					const result = getComponentProps.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				else if (request.type === 'getComponentEvents') {
					const result = getComponentEvents.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				else if (request.type === 'getTemplateContextProps') {
					const result = getTemplateContextProps.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				else if (request.type === 'getComponentNames') {
					const result = getComponentNames.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				else if (request.type === 'getElementAttrs') {
					const result = getElementAttrs.apply(requestContext, request.args as any);
					connection.write(JSON.stringify(result ?? null));
				}
				else {
					console.warn('[Vue Named Pipe Server] Unknown request type:', request.type);
				}
			}
			else {
				console.warn('[Vue Named Pipe Server] No project found for:', fileName);
			}
			connection.end();
		});
		connection.on('error', err => console.error('[Vue Named Pipe Server]', err.message));
	});

	cleanupPipeTable();

	const table = readPipeTable();
	table.push({
		path: pipeFile,
		serverKind,
		currentDirectory,
	});
	updatePipeTable(table);

	try {
		fs.unlinkSync(pipeFile);
	} catch { }

	server.listen(pipeFile);
}

function cleanupPipeTable() {
	for (const server of readPipeTable()) {
		connect(server.path).then(client => {
			if (client) {
				client.end();
			}
			else {
				let table: NamedPipeServer[] = readPipeTable();
				table = table.filter(item => item.path !== server.path);
				updatePipeTable(table);
			}
		});
	}
}

export const projects = new Map<ts.server.Project, {
	info: ts.server.PluginCreateInfo;
	language: Language;
	vueOptions: VueCompilerOptions;
}>();

function getProject(filename: ts.server.NormalizedPath) {
	for (const [project, data] of projects) {
		if (project.containsFile(filename)) {
			return data;
		}
	}
}
