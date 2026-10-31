import * as path from 'node:path';
import { expect, test } from 'vitest';
import { createInferredContentMapperContributions, inferredContentMappers } from '../src/contentMappers';

const extensionPath = path.resolve('/extension');

test('the bundled Content Mapper runs in the first workspace folder, which TS 7.1 resolves from', () => {
	const folders = [path.resolve('/workspace/a'), path.resolve('/workspace/b')];
	const contributions = createInferredContentMapperContributions(extensionPath, '4.0.0', folders);
	expect(contributions).toHaveLength(inferredContentMappers.length);
	for (const { inferredProjectContribution: { manifest } } of contributions) {
		expect(manifest.cwd).toBe(folders[0]);
		expect(manifest.exec[1]).toBe(path.join(extensionPath, 'dist', 'content-mapper-server.js'));
	}
});

test('no Content Mapper is contributed for inferred projects without a workspace folder', () => {
	expect(createInferredContentMapperContributions(extensionPath, '4.0.0', [])).toEqual([]);
});
