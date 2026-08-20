import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { repositoryRoot, runTsc, supportsRunExternalCode } from './utils';

const corpusRoot = path.join(repositoryRoot, 'test-workspace/tsc');

test.skipIf(!supportsRunExternalCode())('content mapper full corpus', () => {
	const sidecarName = `tsconfig.content-mapper-${process.pid}-${randomUUID()}.json`;
	const projects = fs.readdirSync(corpusRoot, { withFileTypes: true })
		.filter(entry =>
			entry.isDirectory()
			&& fs.existsSync(path.join(corpusRoot, entry.name, 'tsconfig.json'))
		)
		.map(entry => entry.name)
		.sort();
	const createdSidecars: string[] = [];

	try {
		for (const project of projects) {
			const sidecar = path.join(corpusRoot, project, sidecarName);
			fs.writeFileSync(
				sidecar,
				JSON.stringify(
					{
						extends: './tsconfig.json',
						contentMappers: [{
							package: '@vue/typescript-content-mapper',
							extensions: ['.vue'],
							options: { languageFeatures: false },
						}],
					},
					undefined,
					'\t',
				) + '\n',
				{ flag: 'wx' },
			);
			createdSidecars.push(sidecar);
		}

		const rootSidecar = path.join(corpusRoot, sidecarName);
		fs.writeFileSync(
			rootSidecar,
			JSON.stringify(
				{
					include: [],
					references: projects.map(project => ({
						path: `./${project}/${sidecarName}`,
					})),
				},
				undefined,
				'\t',
			) + '\n',
			{ flag: 'wx' },
		);
		createdSidecars.push(rootSidecar);

		const result = runTsc([
			'-b',
			rootSidecar,
			'--runExternalCode',
			'--pretty',
			'false',
			'--force',
		]);
		if (result.error || result.signal || result.status === null || result.status > 2) {
			throw new Error(
				`tsc did not complete normally (status ${result.status}, signal ${result.signal}).\n`
					+ result.stdout + result.stderr,
			);
		}
		expect(normalizeDiagnostics(result.stdout + result.stderr)).toMatchSnapshot();
	}
	finally {
		for (const sidecar of createdSidecars.reverse()) {
			fs.rmSync(sidecar, { force: true });
		}
	}
});

function normalizeDiagnostics(output: string) {
	const repositoryPrefix = repositoryRoot.replaceAll('\\', '/') + '/';
	const lines = output
		.replaceAll('\r\n', '\n')
		.split('\n')
		.filter(line => !line.includes('TNB ACTIVE'))
		.map(line => line.replaceAll('\\', '/'))
		.map(line => line.replaceAll(repositoryPrefix, ''))
		.map(line => line.replace(/error vue(\d+):/g, 'error TS$1:'))
		.map(line => line.trimEnd())
		.filter(Boolean);
	const diagnostics: string[] = [];
	let current: string[] = [];
	for (const line of lines) {
		if (isDiagnosticStart(line) && current.length) {
			diagnostics.push(current.join('\n'));
			current = [];
		}
		current.push(line);
	}
	if (current.length) {
		diagnostics.push(current.join('\n'));
	}
	return diagnostics.sort();
}

function isDiagnosticStart(line: string) {
	return !/^\s/.test(line) && (
		/^error TS\d+:/.test(line)
		|| /\(\d+,\d+\): (?:error|warning) TS\d+:/.test(line)
	);
}
