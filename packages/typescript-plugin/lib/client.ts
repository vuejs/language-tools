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

export async function getComponentProps(fileName: string, componentName: string) {
	const server = await getBestServer(fileName);
	if (!server) {
		return;
	}
	const componentAndProps = await server.componentNamesAndProps.get(fileName);
	if (!componentAndProps) {
		return;
	}
	return componentAndProps[componentName];
}

export function getComponentEvents(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentEvents']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentEvents']>>(
		'getComponentEvents',
		...args
	);
}

export function getComponentDirectives(
	...args: Parameters<typeof import('./requests/componentInfos.js')['getComponentDirectives']>
) {
	return sendRequest<ReturnType<typeof import('./requests/componentInfos')['getComponentDirectives']>>(
		'getComponentDirectives',
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

export async function getComponentNames(fileName: string) {
	const server = await getBestServer(fileName);
	if (!server) {
		return;
	}
	const componentAndProps = server.componentNamesAndProps.get(fileName);
	if (!componentAndProps) {
		return;
	}
	return Object.keys(componentAndProps);
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
	const server = await getBestServer(fileName);
	if (!server) {
		return;
	}
	return server.request<T>(requestType, fileName, ...rest);
}
