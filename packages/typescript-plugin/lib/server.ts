import * as fs from 'fs';
import * as net from 'net';
import type * as ts from 'typescript';
import { collectExtractProps } from './requests/collectExtractProps';
import { getComponentEvents, getComponentNames, getComponentProps, getElementAttrs, getTemplateContextProps } from './requests/componentInfos';
import { containsFile } from './requests/containsFile';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from './requests/getQuickInfoAtPosition';
import { NamedPipeServer, connect, pipeTable } from './utils';

export interface Request {
	type: 'containsFile'
	| 'collectExtractProps'
	| 'getPropertiesAtLocation'
	| 'getQuickInfoAtPosition'
	// Component Infos
	| 'getComponentProps'
	| 'getComponentEvents'
	| 'getTemplateContextProps'
	| 'getComponentNames'
	| 'getElementAttrs';
	args: any;
}

let started = false;

export function startNamedPipeServer(serverKind: ts.server.ProjectKind, currentDirectory: string) {

	if (started) return;
	started = true;

	const pipeFile = process.platform === 'win32'
		? `\\\\.\\pipe\\vue-tsp-${process.pid}`
		: `/tmp/vue-tsp-${process.pid}`;
	const server = net.createServer(connection => {
		connection.on('data', data => {
			const text = data.toString();
			const request: Request = JSON.parse(text);
			if (request.type === 'containsFile') {
				const result = containsFile.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'collectExtractProps') {
				const result = collectExtractProps.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getPropertiesAtLocation') {
				const result = getPropertiesAtLocation.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getQuickInfoAtPosition') {
				const result = getQuickInfoAtPosition.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			// Component Infos
			else if (request.type === 'getComponentProps') {
				const result = getComponentProps.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getComponentEvents') {
				const result = getComponentEvents.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getTemplateContextProps') {
				const result = getTemplateContextProps.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getComponentNames') {
				const result = getComponentNames.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getElementAttrs') {
				const result = getElementAttrs.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else {
				console.warn('[Vue Named Pipe Server] Unknown request type:', request.type);
				connection.write(JSON.stringify(null));
			}
		});
		connection.on('error', err => console.error('[Vue Named Pipe Server]', err.message));
	});

	cleanupPipeTable();

	if (!fs.existsSync(pipeTable)) {
		fs.writeFileSync(pipeTable, JSON.stringify([] satisfies NamedPipeServer[]));
	}
	const table: NamedPipeServer[] = JSON.parse(fs.readFileSync(pipeTable, 'utf8'));
	table.push({
		path: pipeFile,
		serverKind,
		currentDirectory,
	});
	fs.writeFileSync(pipeTable, JSON.stringify(table, undefined, 2));

	try {
		fs.unlinkSync(pipeFile);
	} catch { }

	server.listen(pipeFile);
}

function cleanupPipeTable() {
	if (!fs.existsSync(pipeTable)) {
		return;
	}
	for (const server of JSON.parse(fs.readFileSync(pipeTable, 'utf8'))) {
		connect(server.path).then(client => {
			if (client) {
				client.end();
			}
			else {
				let table: NamedPipeServer[] = JSON.parse(fs.readFileSync(pipeTable, 'utf8'));
				table = table.filter(item => item.path !== server.path);
				fs.writeFileSync(pipeTable, JSON.stringify(table, undefined, 2));
			}
		});
	}
}
