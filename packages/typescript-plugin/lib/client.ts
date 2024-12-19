import type { RequestData } from './server';
import { getBestServer } from './utils';

export function collectExtractProps(
	...args: Parameters<typeof import('./requests/collectExtractProps.js')['collectExtractProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/collectExtractProps')['collectExtractProps']>>(
		'collectExtractProps',
		...args
	);
}

export async function getImportPathForFile(
	...args: Parameters<typeof import('./requests/getImportPathForFile.js')['getImportPathForFile']>
) {
	return await sendRequest<ReturnType<typeof import('./requests/getImportPathForFile')['getImportPathForFile']>>(
		'getImportPathForFile',
		...args
	);
}

export async function getPropertiesAtLocation(
	...args: Parameters<typeof import('./requests/getPropertiesAtLocation.js')['getPropertiesAtLocation']>
) {
	return await sendRequest<ReturnType<typeof import('./requests/getPropertiesAtLocation')['getPropertiesAtLocation']>>(
		'getPropertiesAtLocation',
		...args
	);
}

export function getQuickInfoAtPosition(
	...args: Parameters<typeof import('./requests/getQuickInfoAtPosition.js')['getQuickInfoAtPosition']>
) {
	return sendRequest<ReturnType<typeof import('./requests/getQuickInfoAtPosition')['getQuickInfoAtPosition']>>(
		'getQuickInfoAtPosition',
		...args
	);
}

// Component Infos

export function getComponentProps(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentProps']>>(
		'getComponentProps',
		...args
	);
}

export function getComponentEvents(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentEvents']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentEvents']>>(
		'getComponentEvents',
		...args
	);
}

export function getTemplateContextProps(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getTemplateContextProps']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getTemplateContextProps']>>(
		'getTemplateContextProps',
		...args
	);
}

export function getComponentNames(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentNames']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentNames']>>(
		'getComponentNames',
		...args
	);
}

export function getElementAttrs(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getElementAttrs']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getElementAttrs']>>(
		'getElementAttrs',
		...args
	);
}

async function sendRequest<T>(requestType: RequestData[1], fileName: string, ...rest: any[]) {
	const server = (await getBestServer(fileName));
	if (!server) {
		return;
	}
	return server.request<T>(requestType, fileName, ...rest);
}
