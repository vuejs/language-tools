import { posix as path } from 'path-browserify';
import type { Project } from 'typescript-7/async' with { 'resolution-mode': 'import' };
import { getComponentMeta, getExportNames } from './lib/componentMeta';
import type { ComponentMetaContext, MetaCheckerOptions } from './lib/types';

export { getComponentMeta, getExportNames };
export * from './lib/types';

/**
 * Runs the TypeScript 7 API in a child process for the project of `tsconfig`. Every query reads the files from disk
 * into a new snapshot that is released when the query completes.
 */
export async function createChecker(
	tsconfig: string,
	options: MetaCheckerOptions = {},
) {
	tsconfig = tsconfig.replace(/\\/g, '/');

	const ts = {
		...await import('typescript-7/ast'),
		...await import('typescript-7/async'),
	};
	const api = new ts.API({ cwd: path.dirname(tsconfig), runExternalCode: true });
	const context: ComponentMetaContext = { ts, printer: api.printer };

	return {
		getComponentMeta(fileName: string, exportName?: string) {
			return withProject(project => getComponentMeta(context, project, fileName, exportName, options));
		},
		/** The metadata of the default exports of `fileNames`, queried in a single snapshot. */
		getComponentMetas(fileNames: string[]) {
			return withProject(project =>
				Promise.all(fileNames.map(fileName => getComponentMeta(context, project, fileName, 'default', options)))
			);
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
