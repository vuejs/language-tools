import * as fs from 'fs';
import * as net from 'net';
import { collectExtractProps } from './requests/collectExtractProps';
import { getComponentEvents, getComponentNames, getComponentProps, getElementAttrs, getTemplateContextProps } from './requests/componentInfos';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from './requests/getQuickInfoAtPosition';
import { pipeFile } from './utils';

export interface Request {
	type: 'collectExtractProps'
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

export function startNamedPipeServer() {
	if (started) return;
	started = true;
	const server = net.createServer(connection => {
		connection.on('data', data => {
			const request: Request = JSON.parse(data.toString());
			if (request.type === 'collectExtractProps') {
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

	try {
		fs.unlinkSync(pipeFile);
	} catch { }

	server.listen(pipeFile);
}
