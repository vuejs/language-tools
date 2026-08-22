import * as path from 'node:path';
import { test } from 'vitest';

const root = path.resolve(__dirname, '../../..');

const transform = require('@volar/typescript/lib/node/transform.js');
const utils = require('@volar/typescript/lib/node/utils.js');

test('no unmapped diagnostics', () => {
	const originalTransform = transform.transformDiagnostic;
	const originalExit = process.exit;
	const originalArgv = process.argv;
	const unmapped: string[] = [];

	transform.transformDiagnostic = function(
		language: unknown,
		diagnostic: {
			file?: { fileName: string; getLineAndCharacterOfPosition(pos: number): { line: number; character: number } };
			start?: number;
			length?: number;
			code: number;
			messageText: string | { messageText: string };
		},
		program: unknown,
		isTsc: boolean,
	) {
		const result = originalTransform(language, diagnostic, program, isTsc);
		if (
			result === undefined
			&& diagnostic.file
			&& diagnostic.start !== undefined
			&& diagnostic.length !== undefined
		) {
			const [serviceScript] = utils.getServiceScript(language, diagnostic.file.fileName);
			if (serviceScript) {
				let mapped = false;
				for (
					const _ of transform.toSourceRanges(
						undefined,
						language,
						serviceScript,
						diagnostic.start,
						diagnostic.start + diagnostic.length,
						true,
						() => true,
					)
				) {
					mapped = true;
					break;
				}
				if (!mapped) {
					const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
					const msg = typeof diagnostic.messageText === 'string'
						? diagnostic.messageText
						: diagnostic.messageText.messageText;
					unmapped.push(
						`${diagnostic.file.fileName.replace(root + '/', '')}:${pos.line + 1}:${
							pos.character + 1
						} TS${diagnostic.code} ${msg}`,
					);
				}
			}
		}
		return result;
	};

	class ExitError extends Error {}

	try {
		process.exit = ((code?: number) => {
			throw new ExitError(String(code));
		}) as typeof process.exit;

		const { run } = require('../index.js');
		process.argv = [
			process.argv[0]!,
			'vue-tsc',
			'--build',
			path.join(root, 'test-workspace/tsc'),
			'--pretty',
			'false',
		];
		run();
	}
	catch (err) {
		if (!(err instanceof ExitError)) {
			throw err;
		}
	}
	finally {
		process.exit = originalExit;
		process.argv = originalArgv;
		transform.transformDiagnostic = originalTransform;
	}

	const uniq = [...new Set(unmapped)];
	if (uniq.length > 0) {
		const byCode = new Map<string, number>();
		for (const line of uniq) {
			const code = /TS(\d+)/.exec(line)?.[1] ?? '?';
			byCode.set(code, (byCode.get(code) ?? 0) + 1);
		}
		const summary = [
			`Found ${uniq.length} unmapped diagnostics (expect 0):`,
			...[...byCode.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([code, count]) => `  TS${code}: ${count}`),
			'',
			'Sample:',
			...uniq.slice(0, 30),
		].join('\n');
		throw new Error(summary);
	}
});
