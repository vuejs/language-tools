import * as net from 'net';
import type { Request } from './server';
import { pipeFile } from './utils';

export function collectExtractProps(
	...args: Parameters<typeof import('./requests/collectExtractProps.js')['collectExtractProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/collectExtractProps')['collectExtractProps']>>({
		type: 'collectExtractProps',
		args,
	});
}

export async function getPropertiesAtLocation(
	...args: Parameters<typeof import('./requests/getPropertiesAtLocation.js')['getPropertiesAtLocation']>
) {
	return await sendRequest<ReturnType<typeof import('./requests/getPropertiesAtLocation')['getPropertiesAtLocation']>>({
		type: 'getPropertiesAtLocation',
		args,
	});
}

export function getQuickInfoAtPosition(
	...args: Parameters<typeof import('./requests/getQuickInfoAtPosition.js')['getQuickInfoAtPosition']>
) {
	return sendRequest<ReturnType<typeof import('./requests/getQuickInfoAtPosition')['getQuickInfoAtPosition']>>({
		type: 'getQuickInfoAtPosition',
		args,
	});
}

// Component Infos

export function getComponentProps(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentProps']>>({
		type: 'getComponentProps',
		args,
	});
}

export function getComponentEvents(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentEvents']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentEvents']>>({
		type: 'getComponentEvents',
		args,
	});
}

export function getTemplateContextProps(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getTemplateContextProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getTemplateContextProps']>>({
		type: 'getTemplateContextProps',
		args,
	});
}

export function getComponentNames(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentNames']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentNames']>>({
		type: 'getComponentNames',
		args,
	});
}

export function getElementAttrs(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getElementAttrs']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getElementAttrs']>>({
		type: 'getElementAttrs',
		args,
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
				console.error('[Vue Named Pipe Client]', err);
				return resolve(undefined);
			});
		} catch (e) {
			console.error('[Vue Named Pipe Client]', e);
			return resolve(undefined);
		}
	});
}
