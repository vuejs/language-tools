import * as assert from 'node:assert';
import { ensureTypeScriptServerReady, getHover, nthIndex, openDocument } from './utils';

suite('Hover Type Display', () => {
	suite('ref unwrapping', () => {
		suiteSetup(async function() {
			await ensureTypeScriptServerReady('refs-hover.vue', 'count');
		});

		test('ref(0) shows number type in template, not Ref<number>', async () => {
			await openDocument('refs-hover.vue');

			const hover = await getHover(doc => doc.positionAt(nthIndex(doc.getText(), '{{ count }}', 1) + 3));

			// Should show 'number', not 'Ref<number>'
			const hoverText = hover.join('\n');
			assert.ok(hoverText.includes('number'), `Expected to see 'number' in hover, got: ${hoverText}`);
			assert.ok(!hoverText.includes('Ref'), `Should not see 'Ref' in hover for template interpolation`);
		});

		test('ref("hello") shows string type in template', async () => {
			await openDocument('refs-hover.vue');

			const hover = await getHover(doc => doc.positionAt(nthIndex(doc.getText(), '{{ message }}', 1) + 3));

			const hoverText = hover.join('\n');
			assert.ok(hoverText.includes('string'), `Expected to see 'string' in hover, got: ${hoverText}`);
			assert.ok(!hoverText.includes('Ref'), `Should not see 'Ref' in hover`);
		});
	});

	suite('props hover', () => {
		suiteSetup(async function() {
			await ensureTypeScriptServerReady('props-hover.vue', 'title');
		});

		test('props show correct type in template', async () => {
			await openDocument('props-hover.vue');

			const hover = await getHover(doc => doc.positionAt(nthIndex(doc.getText(), '{{ title }}', 1) + 3));

			const hoverText = hover.join('\n');
			assert.ok(hoverText.includes('string'), `Expected 'string' type in hover for title prop`);
		});

		test('optional props show union with undefined', async () => {
			await openDocument('props-hover.vue');

			const hover = await getHover(doc => doc.positionAt(nthIndex(doc.getText(), 'disabled', 1)));

			const hoverText = hover.join('\n');
			assert.ok(
				hoverText.includes('boolean') && hoverText.includes('undefined'),
				`Expected 'boolean | undefined' for optional prop, got: ${hoverText}`,
			);
		});

		test('required number prop shows number type', async () => {
			await openDocument('props-hover.vue');

			const hover = await getHover(doc => doc.positionAt(nthIndex(doc.getText(), '{{ count }}', 1) + 3));

			const hoverText = hover.join('\n');
			assert.ok(hoverText.includes('number'), `Expected 'number' type for count prop`);
		});
	});

	suite('computed unwrapping', () => {
		suiteSetup(async function() {
			await ensureTypeScriptServerReady('computed-hover.vue', 'double');
		});

		test('computed shows return value type, not Computed<T>', async () => {
			await openDocument('computed-hover.vue');

			const hover = await getHover(doc => doc.positionAt(nthIndex(doc.getText(), '{{ double }}', 1) + 3));

			const hoverText = hover.join('\n');
			assert.ok(hoverText.includes('number'), `Expected 'number' return type in hover`);
			assert.ok(!hoverText.includes('Computed'), `Should not see 'Computed<T>' in template hover`);
		});
	});
});
