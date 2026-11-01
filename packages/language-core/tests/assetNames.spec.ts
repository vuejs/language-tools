import { expect, test } from 'vitest';
import { getAssetKeys, getAssetName } from '../lib/names';

test('a template name searches the keys that resolveAsset of Vue searches, in order', () => {
	expect(getAssetKeys('my-dir')).toEqual(['my-dir', 'myDir', 'MyDir']);
	expect(getAssetKeys('focus')).toEqual(['focus', 'Focus']);
});

test('the template name of a key resolves back to the key', () => {
	for (const key of ['myDir', 'MyDir', 'kebab-dir', 'focus', 'ABC', 'my-Dir', 'my_dir']) {
		expect(getAssetKeys(getAssetName(key))).toContain(key);
	}
});
