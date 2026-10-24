import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { createContentMapper } from '../mapper';
import { normalizeCompilerOutput, repositoryRoot, runTsc } from './utils';

const fixturesRoot = path.join(repositoryRoot, 'test-workspace/content-mapper-virtual-code');

// The generated code is type checked as is, without the content mapper suppressing the errors
// outside of the verified ranges, so that codegen does not rely on that or on `@ts-ignore`.
test.each(['ts', 'js'])('generated code of %s components type checks', fixture => {
	const fixtureDir = path.join(fixturesRoot, fixture);
	const configFileName = path.join(fixtureDir, 'tsconfig.json');

	const mapped = runTsc(['-p', configFileName, '--runExternalCode', '--pretty', 'false']);
	expect(normalizeCompilerOutput(mapped)).toBe('');

	// a sibling of the fixture, so that the relative paths in the generated code resolve the same
	const outDir = path.join(fixturesRoot, `.${fixture}-${process.pid}-${randomUUID()}`);
	const mapper = createContentMapper({ name: 'test' });
	try {
		fs.mkdirSync(outDir);
		mapper.openProject({ projectHandle: fixture, configFileName, compilerOptions: {} });
		const ignoredLines: string[] = [];
		for (const fileName of fs.readdirSync(fixtureDir).filter(name => name.endsWith('.vue')).sort()) {
			const { text, extension } = mapper.transform({
				projectHandle: fixture,
				fileName: path.join(fixtureDir, fileName),
				content: fs.readFileSync(path.join(fixtureDir, fileName), 'utf8'),
			});
			fs.writeFileSync(path.join(outDir, fileName + extension), text);
			const lines = text.split('\n');
			lines.forEach((line, i) => {
				if (line.includes('@ts-ignore')) {
					ignoredLines.push(`${fileName + extension}: ${lines[i + 1]!.trim().slice(0, 13)}`);
				}
			});
		}
		expect(ignoredLines).toMatchSnapshot('lines under @ts-ignore');
		const readJson = (fileName: string) => JSON.parse(fs.readFileSync(fileName, 'utf8'));
		fs.writeFileSync(
			path.join(outDir, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: {
					...readJson(path.join(repositoryRoot, 'test-workspace/tsconfig.base.json')).compilerOptions,
					...readJson(configFileName).compilerOptions,
				},
				include: ['*'],
			}),
		);

		const result = runTsc(['-p', path.join(outDir, 'tsconfig.json'), '--pretty', 'false']);
		const diagnostics = (result.stdout + result.stderr)
			.split(/\r?\n/)
			.flatMap(line => {
				const match = /([^/\\]+)\(\d+,\d+\): (error TS\d+: .*)$/.exec(line);
				return match ? [`${match[1]}: ${match[2]}`] : [];
			})
			.sort();
		expect(diagnostics).toMatchSnapshot('diagnostics');
	}
	finally {
		mapper.closeProject(fixture);
		fs.rmSync(outDir, { recursive: true, force: true });
	}
});
