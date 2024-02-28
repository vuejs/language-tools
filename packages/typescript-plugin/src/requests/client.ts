import * as net from 'net';
import type { collectExtractProps } from './collectExtractProps';
import type { getPropertiesAtLocation } from './getPropertiesAtLocation';
import { Request } from './server';
import { pipeFile } from './utils';
import { getQuickInfoAtPosition } from './getQuickInfoAtPosition';

export function sendCollectExtractPropsRequest(fileName: string, templateCodeRange: [number, number]) {
	return sendRequest<ReturnType<typeof collectExtractProps>>({
		type: 'collectExtractProps',
		fileName,
		templateCodeRange,
	});
}

export function sendGetPropertiesAtLocation(fileName: string, position: number) {
	return sendRequest<ReturnType<typeof getPropertiesAtLocation>>({
		type: 'getPropertiesAtLocation',
		fileName,
		position,
	});
}

export function sendGetQuickInfoAtPosition(fileName: string, position: number) {
	return sendRequest<ReturnType<typeof getQuickInfoAtPosition>>({
		type: 'getQuickInfoAtPosition',
		fileName,
		position,
	});
}

function sendRequest<T>(request: Request) {
	return new Promise<T | undefined | null>(resolve => {
		try {
			const client = net.connect(pipeFile);
			client.on('connect', () => {
				client.write(JSON.stringify(request));
			});
			client.on('data', data => {
				const text = data.toString();
				resolve(JSON.parse(text));
				client.end();
			});
			client.on('error', err => {
				console.error(err);
				return resolve(undefined);
			});
		} catch (e) {
			console.error(e);
			return resolve(undefined);
		}
	});
}
