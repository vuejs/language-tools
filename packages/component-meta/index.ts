import { posix as path } from 'path-browserify';
import type { Project } from 'typescript/async' with { 'resolution-mode': 'import' };
import { getComponentMeta, getExportNames } from './lib/componentMeta';

export { getComponentMeta, getExportNames };
export * from './lib/types';

/**
 * Runs the TypeScript 7 API in a child process for the project of `tsconfig`. Every query reads the files from disk
 * into a new snapshot that is released when the query completes.
 */
export async function createChecker(tsconfig: string) {
	tsconfig = tsconfig.replace(/\\/g, '/');

	const ts = {
		...await import('typescript/ast'),
		...await import('typescript/async'),
	};
	const api = new ts.API({ cwd: path.dirname(tsconfig), runExternalCode: true });

	return {
		getComponentMeta(fileName: string, exportName?: string) {
			return withProject(project => getComponentMeta(ts, project, fileName, exportName));
		},
		/** The metadata of the default exports of `fileNames`, queried in a single snapshot. */
		getComponentMetas(fileNames: string[]) {
			return withProject(project => Promise.all(fileNames.map(fileName => getComponentMeta(ts, project, fileName))));
		},
		getExportNames(fileName: string) {
			return withProject(project => getExportNames(project, fileName));
		},
		close() {
			return api.close();
		},
		[Symbol.asyncDispose]() {
			return api.close();
		},
	};

	async function withProject<T>(query: (project: Project) => Promise<T>) {
		const snapshot = await api.createSnapshot({ openProjects: [tsconfig] });
		try {
			const project = snapshot.getConfiguredProject(tsconfig);
			if (!project) {
				throw new Error(`Failed to open project '${tsconfig}'.`);
			}
			return await query(project);
		}
		finally {
			await snapshot.dispose();
		}
	}
}
