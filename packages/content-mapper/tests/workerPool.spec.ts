import * as path from 'node:path';
import { expect, test } from 'vitest';
import { TransformPool } from '../workerPool';

test('transforms files concurrently with project state in every worker', async () => {
	const pool = new TransformPool(2);
	const projectHandle = 'worker-project';
	const configFileName = path.resolve(__dirname, '../../../test-workspace/content-mapper/tsconfig.json');
	await pool.openProject({
		configFileName,
		projectHandle,
		compilerOptions: { strict: true },
	});

	const results = await Promise.all(
		Array.from({ length: 64 }, (_, index) =>
			pool.transform({
				projectHandle,
				fileName: path.resolve(__dirname, `Worker${index}.vue`),
				content: `<script setup lang="ts">const value${index} = ${index};</script>
<template>{{ value${index}.toFixed() }}</template>`,
			})
		),
	);

	await pool.closeProject({ projectHandle });
	await pool.close();

	for (let index = 0; index < results.length; index++) {
		expect(results[index]!.text).toContain(`value${index}`);
		expect(results[index]!.mappings.length).toBeGreaterThan(0);
	}
});

test('rejects requests when a worker exits cleanly but unexpectedly', async () => {
	const pool = new TransformPool(
		2,
		path.resolve(__dirname, 'fixtures/exitWorker.cjs'),
	);

	await expect(pool.openProject({
		configFileName: '',
		projectHandle: 'exited-worker-project',
		compilerOptions: {},
	})).rejects.toThrow(/exited unexpectedly with code 0/);
	await pool.close();
});

test('rejects in-flight requests when the pool closes', async () => {
	const pool = new TransformPool(
		2,
		path.resolve(__dirname, 'fixtures/idleWorker.cjs'),
	);
	const request = pool.openProject({
		configFileName: '',
		projectHandle: 'closing-worker-project',
		compilerOptions: {},
	});
	const rejection = expect(request).rejects.toThrow(/pool is shutting down/);

	await pool.close();
	await rejection;
});
