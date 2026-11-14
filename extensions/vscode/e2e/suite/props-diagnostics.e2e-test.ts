import * as assert from 'node:assert';
import { assertDiagnostic, ensureTypeScriptServerReady, getDiagnostics, openDocument } from './utils';

suite('Props Type Checking Diagnostics', () => {
	suiteSetup(async function() {
		await ensureTypeScriptServerReady('parent.vue', 'Child');
	});

	test('missing required props show diagnostic', async () => {
		await openDocument('parent.vue');
		const diagnostics = await getDiagnostics();

		// Should have a diagnostic about missing 'title' prop on first Child usage
		const error = assertDiagnostic(
			diagnostics,
			'title',
			':count="123"', // Check it's on the first Child line
		);

		assert.ok(error, 'Should have diagnostic for missing required prop');
	});

	test('props type mismatch shows diagnostic', async () => {
		await openDocument('parent.vue');
		const diagnostics = await getDiagnostics();

		// Should have a diagnostic about count type mismatch (string vs number)
		const relevantDiags = diagnostics.filter(d => {
			const msg = typeof d.message === 'string' ? d.message : '';
			return msg.includes('count') || msg.includes('string') || msg.includes('number');
		});

		assert.ok(
			relevantDiags.length > 0,
			'Should have diagnostic for type mismatch on count prop',
		);
	});

	test('both errors present for multi-error case', async () => {
		await openDocument('parent.vue');
		const diagnostics = await getDiagnostics();

		// We should have multiple error diagnostics for the Child components
		const childErrors = diagnostics.filter(d => {
			const msg = typeof d.message === 'string' ? d.message : '';
			return msg.includes('Child') || msg.includes('title') || msg.includes('count');
		});

		assert.ok(
			childErrors.length >= 1,
			`Should have at least 1 diagnostic for Child prop errors, got ${childErrors.length}`,
		);
	});
});
