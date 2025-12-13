import { assertHover, ensureTypeScriptServerReady, getHover } from './utils';

suite('Vue Hover Types', () => {
	suiteSetup(async function() {
		await ensureTypeScriptServerReady('test.vue', 'ServerReadinessProbe');
	});

	test('primitive', async () => {
		const hover = await getHover('TestPrimitiveObj');
		const expected = `type TestPrimitiveObj = { value: string; }`;
		assertHover(hover, expected);
	});
});
