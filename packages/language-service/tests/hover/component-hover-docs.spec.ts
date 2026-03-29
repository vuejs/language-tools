import { describe, expect, it } from 'vitest';
import { formatComponentMeta } from '../../lib/plugins/vue-template/componentHoverDocs';
import { mockComponentMeta } from './mock-component-meta';

describe('componentHoverDocs.ts', () => {
	describe('snapshots', () => {
		it.each(['Table', 'Markdown', 'JSDoc'] as const)('%s', format => {
			const result = formatComponentMeta(mockComponentMeta, format);

			expect(result).toMatchSnapshot();
		});
	});
});
