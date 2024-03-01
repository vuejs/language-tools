import * as fs from 'fs';
import * as net from 'net';
import type * as ts from 'typescript';
import { collectExtractProps } from './requests/collectExtractProps';
import { getComponentEvents, getComponentNames, getComponentProps, getElementAttrs, getTemplateContextProps } from './requests/componentInfos';
import { containsFile } from './requests/containsFile';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from './requests/getQuickInfoAtPosition';
import { PipeTable, pipeTable } from './utils';

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

export function startNamedPipeServer(serverKind: ts.server.ProjectKind) {

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

	clearupPipeTable();

	if (!fs.existsSync(pipeTable)) {
		fs.writeFileSync(pipeTable, JSON.stringify({}));
	}
	const table: PipeTable = JSON.parse(fs.readFileSync(pipeTable, 'utf8'));
	table[process.pid] = {
		pid: process.pid,
		pipeFile,
		serverKind,
	};
	fs.writeFileSync(pipeTable, JSON.stringify(table, undefined, 2));

	try {
		fs.unlinkSync(pipeFile);
	} catch { }

	server.listen(pipeFile);
}

function clearupPipeTable() {
	if (fs.existsSync(pipeTable)) {
		const table: PipeTable = JSON.parse(fs.readFileSync(pipeTable, 'utf8'));
		for (const pid in table) {
			const { pipeFile } = table[pid];
			try {
				const client = net.connect(pipeFile);
				client.on('connect', () => {
					client.end();
				});
				client.on('error', () => {
					const table = JSON.parse(fs.readFileSync(pipeTable, 'utf8'));
					delete table[pid];
					fs.writeFileSync(pipeTable, JSON.stringify(table, undefined, 2));
				});
			} catch { }
		}
	}
}
