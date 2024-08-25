import type { Request } from './server';
import { searchNamedPipeServerForFile, sendRequestWorker } from './utils';

export function collectExtractProps(
	...args: Parameters<typeof import('./requests/collectExtractProps.js')['collectExtractProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/collectExtractProps')['collectExtractProps']>>({
		type: 'collectExtractProps',
		args,
	});
}

export async function getImportPathForFile(
	...args: Parameters<typeof import('./requests/getImportPathForFile.js')['getImportPathForFile']>
) {
	return await sendRequest<ReturnType<typeof import('./requests/getImportPathForFile')['getImportPathForFile']>>({
		type: 'getImportPathForFile',
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

async function sendRequest<T>(request: Request) {
	const server = (await searchNamedPipeServerForFile(request.args[0]));
	if (!server) {
		console.warn('[Vue Named Pipe Client] No server found for', request.args[0]);
		return;
	}
	const res = await sendRequestWorker<T>(request, server.socket);
	server.socket.end();
	return res;
}
