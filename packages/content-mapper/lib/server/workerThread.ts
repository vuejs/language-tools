import { parentPort } from 'node:worker_threads';
import type { ContentMapper } from '../mapper/contentMapper';
import type { CloseProjectParams, OpenProjectParams, TransformParams } from '../protocol';

/** Runs a content mapper worker thread, which owns the project state of the worker pool. */
export function runMapperWorker(mapper: ContentMapper) {
	if (!parentPort) {
		throw new Error(`${mapper.name} worker requires a parent port`);
	}

	parentPort.on('message', ({ id, method, params }) => {
		try {
			const result = method === 'openProject'
				? mapper.openProject(params as OpenProjectParams)
				: method === 'closeProject'
				? mapper.closeProject((params as CloseProjectParams).projectHandle)
				: mapper.transform(params as TransformParams);
			parentPort!.postMessage({ id, result });
		}
		catch (error) {
			parentPort!.postMessage({
				id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});
}
