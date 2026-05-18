import type { VueLanguagePlugin } from '../types';
import { allCodeFeatures } from './shared';

const plugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, ir) {
			const result: {
				id: string;
				lang: string;
			}[] = [];
			for (let i = 0; i < ir.styles.length; i++) {
				const style = ir.styles[i];
				if (style) {
					result.push({
						id: 'style_' + i,
						lang: style.lang,
					});
					if (style.bindings.length) {
						result.push({
							id: 'style_' + i + '_inline_ts',
							lang: 'ts',
						});
					}
				}
			}
			return result;
		},

		resolveEmbeddedCode(_fileName, ir, embeddedFile) {
			if (embeddedFile.id.startsWith('style_')) {
				const index = parseInt(embeddedFile.id.split('_')[1]!);
				const style = ir.styles[index]!;
				if (embeddedFile.id.endsWith('_inline_ts')) {
					embeddedFile.parentCodeId = 'style_' + index;
					for (const binding of style.bindings) {
						embeddedFile.content.push(
							'(',
							[
								binding.text,
								style.name,
								binding.offset,
								allCodeFeatures,
							],
							');\n',
						);
					}
				}
				else {
					embeddedFile.content.push([
						style.content,
						style.name,
						0,
						allCodeFeatures,
					]);
				}
			}
		},
	};
};

export default plugin;
