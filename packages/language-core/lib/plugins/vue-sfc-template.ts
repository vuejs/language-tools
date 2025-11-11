import type * as CompilerDOM from '@vue/compiler-dom';
import type { VueLanguagePlugin } from '../types';
import { forEachInterpolationNode } from '../utils/forEachTemplateNode';
import { allCodeFeatures } from './shared';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, sfc) {
			if (sfc.template?.lang === 'html') {
				return [{
					id: 'template',
					lang: sfc.template.lang,
				}];
			}
			return [];
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id === 'template' && sfc.template?.lang === 'html') {
				const locs: CompilerDOM.SourceLocation[] = [];
				if (sfc.template.ast) {
					for (const node of forEachInterpolationNode(sfc.template.ast)) {
						locs.push(node.loc);
					}
				}

				// replace interpolations with spaces
				let offset = 0;
				for (const loc of locs) {
					embeddedFile.content.push([
						sfc.template.content.slice(offset, loc.start.offset + 2),
						sfc.template.name,
						offset,
						allCodeFeatures,
					], ' '.repeat(loc.source.length - 4));
					offset = loc.end.offset - 2;
				}
				embeddedFile.content.push([
					sfc.template.content.slice(offset),
					sfc.template.name,
					offset,
					allCodeFeatures,
				]);
			}
		},
	};
};

export default plugin;
