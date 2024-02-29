import * as fs from 'fs';
import * as net from 'net';
import { collectExtractProps } from './requests/collectExtractProps';
import { getPropertiesAtLocation } from './requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from './requests/getQuickInfoAtPosition';
import { pipeFile } from './utils';

export interface CollectExtractPropsRequest {
	type: 'collectExtractProps';
	fileName: string;
	templateCodeRange: [number, number];
}

export interface GetPropertiesAtLocationRequest {
	type: 'getPropertiesAtLocation';
	fileName: string;
	position: number;
}

export interface GetQuickInfoAtPosition {
	type: 'getQuickInfoAtPosition';
	fileName: string;
	position: number;
}

export type Request = CollectExtractPropsRequest
	| GetPropertiesAtLocationRequest
	| GetQuickInfoAtPosition;

let started = false;

export function startNamedPipeServer() {
	if (started) return;
	started = true;
	const server = net.createServer(connection => {
		connection.on('data', data => {
			const request: Request = JSON.parse(data.toString());
			if (request.type === 'collectExtractProps') {
				const result = collectExtractProps(request.fileName, request.templateCodeRange);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getPropertiesAtLocation') {
				const result = getPropertiesAtLocation(request.fileName, request.position);
				connection.write(JSON.stringify(result ?? null));
			}
			else if (request.type === 'getQuickInfoAtPosition') {
				const result = getQuickInfoAtPosition(request.fileName, request.position);
				connection.write(JSON.stringify(result ?? null));
			}
			else {
				connection.write(JSON.stringify(null));
			}
		});
		connection.on('error', err => console.error(err.message));
	});

	try {
		fs.unlinkSync(pipeFile);
	} catch (error) { }

	server.listen(pipeFile);
}
