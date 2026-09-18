import { createContentMapper } from './mapper';
import { toOptionDiagnostics } from './optionDiagnostics';

/** The `.vue` content mapper: Vue single-file components, registered for `.vue` by the host. */
export const vueContentMapper = createContentMapper({
	name: 'Vue content mapper',
	toOptionDiagnostics,
});

export const openProject = vueContentMapper.openProject;
export const closeProject = vueContentMapper.closeProject;
export const transformVue = vueContentMapper.transform;
