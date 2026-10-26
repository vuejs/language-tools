import * as path from 'node:path';

/**
 * Content mappers for files outside any tsconfig, registered with TypeScript and passed to the language
 * server. Each contribution runs its own mapper process, since the host keys processes by contribution.
 */
export const inferredContentMappers = [
	{
		package: '@vue/content-mapper',
		extensions: ['.vue'],
		options: { languageFeatures: true, target: 99, format: 'sfc' },
	},
	{
		package: '@vue/content-mapper',
		extensions: ['.vue.md'],
		options: { languageFeatures: true, target: 99, format: 'vitepress' },
	},
];

/** The inferred project contributions of the Content Mapper bundled in the extension at `extensionPath`. */
export function createInferredContentMapperContributions(extensionPath: string, version: string) {
	return inferredContentMappers.map(({ package: name, extensions, options }) => ({
		extensions,
		inferredProjectContribution: {
			options,
			manifest: {
				name,
				version,
				exec: [
					process.execPath,
					path.join(extensionPath, 'dist', 'content-mapper-server.js'),
					`--worker=${path.join(extensionPath, 'dist', 'content-mapper-worker.js')}`,
				],
				cwd: extensionPath,
				dynamicConfig: true,
			},
		},
	}));
}
