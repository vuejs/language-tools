import * as net from 'net';
import type { Request } from './server';
import { pipeFile } from './utils';

export function collectExtractPropsRequest(fileName: string, templateCodeRange: [number, number]) {
	return sendRequest<ReturnType<typeof import('./requests/collectExtractProps')['collectExtractProps']>>({
		type: 'collectExtractProps',
		fileName,
		templateCodeRange,
	});
}

export function getPropertiesAtLocation(fileName: string, position: number) {
	return sendRequest<ReturnType<typeof import('./requests/getPropertiesAtLocation')['getPropertiesAtLocation']>>({
		type: 'getPropertiesAtLocation',
		fileName,
		position,
	});
}

export function getQuickInfoAtPosition(fileName: string, position: number) {
	return sendRequest<ReturnType<typeof import('./requests/getQuickInfoAtPosition')['getQuickInfoAtPosition']>>({
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
