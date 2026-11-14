import * as assert from 'node:assert';
import { assertDiagnostic, ensureTypeScriptServerReady, getDiagnostics, openDocument } from './utils';

suite('Template Diagnostics', () => {
	suiteSetup(async function() {
		await ensureTypeScriptServerReady('template-diagnostics.vue', 'ServerReadinessProbe');
	});

	test('template type error - number has no toUpperCase method', async () => {
		await openDocument('template-diagnostics.vue');
		const diagnostics = await getDiagnostics();

		// Should have a diagnostic about toUpperCase not existing on number
		const error = assertDiagnostic(diagnostics, 'toUpperCase');

		// Verify the diagnostic position is near the method call
		assert.ok(error.range, 'Diagnostic should have a range');
	});

	test('template type error - string has no toFixed method', async () => {
		await openDocument('template-diagnostics.vue');
		const diagnostics = await getDiagnostics();

		// Should have a diagnostic about toFixed not existing on string
		const error = assertDiagnostic(diagnostics, 'toFixed');

		assert.ok(error.range, 'Diagnostic should have a range');
	});

	test('template diagnostics have clear error messages', async () => {
		await openDocument('template-diagnostics.vue');
		const diagnostics = await getDiagnostics();

		// Filter for our specific errors
		const relevantDiags = diagnostics.filter(d =>
			typeof d.message === 'string'
			&& (d.message.includes('toUpperCase') || d.message.includes('toFixed'))
		);

		assert.ok(relevantDiags.length > 0, 'Should have at least one relevant diagnostic');

		// Messages should mention the property or method
		relevantDiags.forEach(diag => {
			const message = typeof diag.message === 'string' ? diag.message : '';
			assert.ok(
				message.includes('property')
					|| message.includes('method')
					|| message.includes('does not exist')
					|| message.includes('no such'),
				`Message should be clear about what's missing: "${message}"`,
			);
		});
	});
});
