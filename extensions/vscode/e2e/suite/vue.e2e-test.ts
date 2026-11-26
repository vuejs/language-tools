import { assertHover, ensureTypeScriptServerReady, getHover, nthIndex } from './utils';

suite('Vue Hover Types', () => {
	suiteSetup(async function() {
		await ensureTypeScriptServerReady('test.vue', 'ServerReadinessProbe');
	});

	test('primitive', async () => {
		const hover = await getHover(
			doc => doc.positionAt(nthIndex(doc.getText(), 'TestPrimitiveObj', 1) + 1),
		);

		const expected = `type TestPrimitiveObj = { value: string; }`;
		assertHover(hover, expected);
	});
});
