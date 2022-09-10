import { VueLanguagePlugin } from '@volar/vue-language-core';
import * as useVueHtmlFilePlugin from '@volar/vue-language-core/out/plugins/file-html';

const plugin: VueLanguagePlugin = (ctx) => {

	const vueHtmlFilePlugin = useVueHtmlFilePlugin(ctx);

	return {

		order: -1,

		parseSFC(fileName, content) {

			if (fileName.endsWith('.html')) {

				let newContent = content;

				// replace v- to x-
				for (const v_ of content.matchAll(/<[^>]+(v-)[^<]+/g)) {
					if (v_.index !== undefined) {
						const index = v_.index + v_[0].indexOf('v-');
						newContent = newContent.slice(0, index) + 'x-' + newContent.slice(index + 2);
					}
				}

				// replace x- to v-
				for (const x_ of content.matchAll(/<[^>]+(x-)[^<]+/g)) {
					if (x_.index !== undefined) {
						const index = x_.index + x_[0].indexOf('x-');
						newContent = newContent.slice(0, index) + 'v-' + newContent.slice(index + 2);
					}
				}

				return vueHtmlFilePlugin.parseSFC?.(fileName, newContent);
			};
		}
	};
};
export = plugin;
