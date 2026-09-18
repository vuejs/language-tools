import { createContentMapper, toOptionDiagnostics } from '@vue/content-mapper';
import { markdownPlugin } from './plugin';

/** The VitePress content mapper: markdown files, registered for `.md` by the host. */
export const vitePressContentMapper = createContentMapper({
	name: 'VitePress content mapper',
	defaultLanguageId: 'markdown',
	plugins: () => [markdownPlugin],
	toOptionDiagnostics,
});
