import * as fs from 'fs';
import * as net from 'net';
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
		connection.on('data', async data => {
			const request: Request = JSON.parse(data.toString());
			if (request.type === 'collectExtractProps') {
				const result = (await import('./requests/collectExtractProps.js')).collectExtractProps.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getPropertiesAtLocation') {
				const result = (await import('./requests/getPropertiesAtLocation.js')).getPropertiesAtLocation.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getQuickInfoAtPosition') {
				const result = (await import('./requests/getQuickInfoAtPosition.js')).getQuickInfoAtPosition.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			// Component Infos
			else if (request.type === 'getComponentProps') {
				const result = (await import('./requests/componentInfos.js')).getComponentProps.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getComponentEvents') {
				const result = (await import('./requests/componentInfos.js')).getComponentEvents.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getTemplateContextProps') {
				const result = (await import('./requests/componentInfos.js')).getTemplateContextProps.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getComponentNames') {
				const result = (await import('./requests/componentInfos.js')).getComponentNames.apply(null, request.args);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getElementAttrs') {
				const result = (await import('./requests/componentInfos.js')).getElementAttrs.apply(null, request.args);
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
