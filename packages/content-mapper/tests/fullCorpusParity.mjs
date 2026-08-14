import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const corpusRoot = path.join(repositoryRoot, 'test-workspace/tsc');
const sidecarName = `tsconfig.content-mapper-parity-${process.pid}-${randomUUID()}.json`;
const options = parseOptions(process.argv.slice(2));
const tsgoPath = options.tsgoPath ?? process.env.TSGO_PATH;

if (!tsgoPath) {
	fail('Pass --tsgo <path> or set TSGO_PATH.');
}
if (!fs.existsSync(tsgoPath)) {
	fail(`tsgo was not found at ${tsgoPath}.`);
}

const projects = fs.readdirSync(corpusRoot, { withFileTypes: true })
	.filter(entry =>
		entry.isDirectory()
		&& fs.existsSync(path.join(corpusRoot, entry.name, 'tsconfig.json'))
	)
	.map(entry => entry.name)
	.sort();
const sidecars = projects.map(project => path.join(corpusRoot, project, sidecarName));
const rootSidecar = path.join(corpusRoot, sidecarName);
const createdSidecars = [];
const buildInfoFiles = [...sidecars, rootSidecar].map(sidecar => sidecar.replace(/\.json$/, '.tsbuildinfo'));

try {
	for (const sidecar of sidecars) {
		fs.writeFileSync(
			sidecar,
			JSON.stringify(
				{
					extends: './tsconfig.json',
					contentMappers: [{
						package: '@vue/typescript-content-mapper',
						extensions: ['.vue'],
						options: {
							languageFeatures: false,
						},
					}],
				},
				undefined,
				'\t',
			) + '\n',
			{ flag: 'wx' },
		);
		createdSidecars.push(sidecar);
	}
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

	const mapper = run(tsgoPath, [
		'-b',
		rootSidecar,
		'--runExternalCode',
		'--pretty',
		'false',
		'--force',
	]);
	const vueTsc = run(process.execPath, [
		path.join(repositoryRoot, 'packages/tsc/bin/vue-tsc.js'),
		'-b',
		rootSidecar,
		'--pretty',
		'false',
		'--force',
	]);
	assertCompilerCompleted('content-mapped tsgo', mapper);
	assertCompilerCompleted('vue-tsc', vueTsc);
	const mapperDiagnostics = normalize(mapper.output);
	const vueTscDiagnostics = normalize(vueTsc.output);
	const comparison = compare(vueTscDiagnostics, mapperDiagnostics);

	printReport(projects, comparison, vueTsc, mapper);
	if (options.outputDirectory) {
		writeReport(
			options.outputDirectory,
			projects,
			comparison,
			vueTscDiagnostics,
			mapperDiagnostics,
		);
	}
	if (
		options.check
		&& (
			comparison.vueTscOnly.length
			|| comparison.mapperOnly.length
			|| comparison.vueTscGlobal.length
			|| comparison.mapperGlobal.length
		)
	) {
		process.exitCode = 1;
	}
}
finally {
	for (const buildInfoFile of buildInfoFiles) {
		fs.rmSync(buildInfoFile, { force: true });
	}
	for (const sidecar of createdSidecars.reverse()) {
		fs.rmSync(sidecar, { force: true });
	}
}

function parseOptions(args) {
	let tsgoPath;
	let outputDirectory;
	let check = false;
	for (let index = 0; index < args.length; index++) {
		const argument = args[index];
		if (argument === '--') {
			continue;
		}
		else if (argument === '--check') {
			check = true;
		}
		else if (argument === '--tsgo') {
			tsgoPath = args[++index];
		}
		else if (argument.startsWith('--tsgo=')) {
			tsgoPath = argument.slice('--tsgo='.length);
		}
		else if (argument === '--output') {
			outputDirectory = args[++index];
		}
		else if (argument.startsWith('--output=')) {
			outputDirectory = argument.slice('--output='.length);
		}
		else {
			fail(`Unknown argument: ${argument}`);
		}
	}
	return { check, outputDirectory, tsgoPath };
}

function run(command, args) {
	const started = performance.now();
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: 'utf8',
		env: {
			...process.env,
			VUE_CONTENT_MAPPER_WORKERS: process.env.VUE_CONTENT_MAPPER_WORKERS ?? '4',
		},
		maxBuffer: 100 * 1024 * 1024,
	});
	if (result.error) {
		throw result.error;
	}
	return {
		durationMs: performance.now() - started,
		output: result.stdout + result.stderr,
		signal: result.signal,
		status: result.status,
	};
}

function assertCompilerCompleted(label, result) {
	if (result.signal || result.status === null || result.status > 2) {
		throw new Error(
			`${label} did not complete normally (status ${result.status}, signal ${result.signal}).\n`
				+ result.output,
		);
	}
}

function normalize(output) {
	const repositoryPrefix = repositoryRoot.replaceAll('\\', '/') + '/';
	const lines = output
		.replaceAll('\r\n', '\n')
		.replace(/\u001B\[[0-9;]*m/g, '')
		.split('\n')
		.filter(line => !line.includes('TNB ACTIVE'))
		.map(line => line.replaceAll('\\', '/'))
		.map(line => line.replaceAll(repositoryPrefix, ''))
		.map(line => line.replace(/error vue(\d+):/g, 'error TS$1:'))
		.map(line => line.trimEnd())
		.filter(Boolean);
	const diagnostics = [];
	let current = [];
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

function isDiagnosticStart(line) {
	return !/^\s/.test(line) && (
		/^error TS\d+:/.test(line)
		|| /\(\d+,\d+\): (?:error|warning) TS\d+:/.test(line)
	);
}

function compare(vueTscDiagnostics, mapperDiagnostics) {
	const vueTscCounts = count(vueTscDiagnostics);
	const mapperCounts = count(mapperDiagnostics);
	const matched = [];
	const vueTscOnly = [];
	const mapperOnly = [];
	for (const line of new Set([...vueTscCounts.keys(), ...mapperCounts.keys()])) {
		const vueTscCount = vueTscCounts.get(line) ?? 0;
		const mapperCount = mapperCounts.get(line) ?? 0;
		matched.push(...Array(Math.min(vueTscCount, mapperCount)).fill(line));
		vueTscOnly.push(...Array(Math.max(0, vueTscCount - mapperCount)).fill(line));
		mapperOnly.push(...Array(Math.max(0, mapperCount - vueTscCount)).fill(line));
	}
	const projectStatus = new Map();
	const unattributedDifferences = [];
	for (
		const [source, lines] of [
			['vue-tsc', vueTscOnly],
			['mapper', mapperOnly],
		]
	) {
		for (const line of lines) {
			const project = getProject(line);
			if (project) {
				const status = projectStatus.get(project) ?? new Set();
				status.add(source);
				projectStatus.set(project, status);
			}
			else {
				unattributedDifferences.push({ source, diagnostic: line });
			}
		}
	}
	return {
		mapperGlobal: mapperDiagnostics.filter(diagnostic => !getProject(diagnostic)),
		mapperOnly: mapperOnly.sort(),
		matched: matched.sort(),
		projectStatus,
		unattributedDifferences,
		vueTscGlobal: vueTscDiagnostics.filter(diagnostic => !getProject(diagnostic)),
		vueTscOnly: vueTscOnly.sort(),
	};
}

function count(lines) {
	const result = new Map();
	for (const line of lines) {
		result.set(line, (result.get(line) ?? 0) + 1);
	}
	return result;
}

function getProject(line) {
	return /^test-workspace\/tsc\/([^/]+)\//.exec(line)?.[1];
}

function printReport(projects, comparison, vueTsc, mapper) {
	const denominator = Math.max(
		comparison.matched.length + comparison.vueTscOnly.length,
		comparison.matched.length + comparison.mapperOnly.length,
		1,
	);
	const hasGlobalDiagnostics = comparison.vueTscGlobal.length || comparison.mapperGlobal.length;
	const exactProjects = hasGlobalDiagnostics
		? undefined
		: projects.length - comparison.projectStatus.size;
	console.log(`Projects: ${projects.length}`);
	console.log(`Projects with exact output: ${exactProjects ?? 'unknown (global differences present)'}`);
	console.log(`Projects with differences: ${comparison.projectStatus.size}`);
	if (comparison.unattributedDifferences.length) {
		console.log(`Global differences: ${comparison.unattributedDifferences.length}`);
	}
	if (hasGlobalDiagnostics) {
		console.log(`vue-tsc global diagnostics: ${comparison.vueTscGlobal.length}`);
		console.log(`mapper global diagnostics: ${comparison.mapperGlobal.length}`);
	}
	console.log(
		`Matching diagnostics: ${comparison.matched.length}/${denominator} (${
			formatPercent(comparison.matched.length / denominator)
		})`,
	);
	console.log(`vue-tsc-only diagnostics: ${comparison.vueTscOnly.length}`);
	console.log(`mapper-only diagnostics: ${comparison.mapperOnly.length}`);
	console.log(`vue-tsc: ${formatDuration(vueTsc.durationMs)} (exit ${vueTsc.status})`);
	console.log(`mapper: ${formatDuration(mapper.durationMs)} (exit ${mapper.status})`);
	printDifferences('First vue-tsc-only diagnostics', comparison.vueTscOnly);
	printDifferences('First mapper-only diagnostics', comparison.mapperOnly);
}

function printDifferences(title, lines) {
	if (!lines.length) {
		return;
	}
	console.log(`\n${title}:`);
	for (const line of lines.slice(0, 20)) {
		console.log(`- ${line.replaceAll('\n', '\n  ')}`);
	}
	if (lines.length > 20) {
		console.log(`- ... ${lines.length - 20} more`);
	}
}

function writeReport(
	outputDirectory,
	projects,
	comparison,
	vueTscDiagnostics,
	mapperDiagnostics,
) {
	const resolved = path.resolve(outputDirectory);
	fs.mkdirSync(resolved, { recursive: true });
	fs.writeFileSync(
		path.join(resolved, 'vue-tsc.txt'),
		vueTscDiagnostics.join(os.EOL) + os.EOL,
	);
	fs.writeFileSync(
		path.join(resolved, 'content-mapper.txt'),
		mapperDiagnostics.join(os.EOL) + os.EOL,
	);
	fs.writeFileSync(
		path.join(resolved, 'report.json'),
		JSON.stringify(
			{
				projectCount: projects.length,
				exactProjectCount: comparison.vueTscGlobal.length || comparison.mapperGlobal.length
					? null
					: projects.length - comparison.projectStatus.size,
				differentProjects: [...comparison.projectStatus].map(([project, sources]) => ({
					project,
					sources: [...sources],
				})),
				mapperOnly: comparison.mapperOnly,
				mapperGlobal: comparison.mapperGlobal,
				matchedDiagnosticCount: comparison.matched.length,
				unattributedDifferences: comparison.unattributedDifferences,
				vueTscGlobal: comparison.vueTscGlobal,
				vueTscOnly: comparison.vueTscOnly,
			},
			undefined,
			2,
		) + os.EOL,
	);
	console.log(`\nWrote full outputs and JSON report to ${resolved}`);
}

function formatDuration(durationMs) {
	return `${(durationMs / 1000).toFixed(3)}s`;
}

function formatPercent(value) {
	return `${(value * 100).toFixed(1)}%`;
}

function fail(message) {
	console.error(message);
	process.exit(1);
}
