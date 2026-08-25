import * as assert from 'node:assert';
import { ensureTypeScriptServerReady, getCompletions, openDocument } from './utils';

suite('Completions', () => {
	suiteSetup(async function() {
		await ensureTypeScriptServerReady('completions-test.vue', 'text');
	});

	test('string method completions available after member access', async () => {
		await openDocument('completions-test.vue');

		const completions = await getCompletions(doc => {
			// Find "text." position
			const textDotPos = doc.getText().indexOf('{{ text.');
			// Position after the dot
			return doc.positionAt(textDotPos + 8);
		});

		const labels = completions.map(c => typeof c.label === 'string' ? c.label : c.label.label);

		// Should include common string methods
		assert.ok(
			labels.includes('toUpperCase') || labels.some(l => l.startsWith('toUpperCase')),
			`Expected 'toUpperCase' in completions, got: ${labels.slice(0, 10).join(', ')}`,
		);
		assert.ok(
			labels.includes('toLowerCase') || labels.some(l => l.startsWith('toLowerCase')),
			`Expected 'toLowerCase' in completions`,
		);
		assert.ok(
			labels.includes('slice') || labels.some(l => l.startsWith('slice')),
			`Expected 'slice' in completions`,
		);
	});

	test('completions not empty', async () => {
		await openDocument('completions-test.vue');

		const completions = await getCompletions(doc => {
			const textDotPos = doc.getText().indexOf('{{ text.');
			return doc.positionAt(textDotPos + 8);
		});

		assert.ok(completions.length > 0, 'Should have at least one completion');
	});
});
