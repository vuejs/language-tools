import { VueLanguagePlugin } from '@volar/vue-typescript';
import useVueHtmlFilePlugin from '@volar/vue-typescript/out/plugins/file-html';

export default function (): VueLanguagePlugin {

	const vueHtmlFilePlugin = useVueHtmlFilePlugin();

	return {

		compileFileToVue(fileName, content) {

			if (fileName.endsWith('.html')) {

				let newContent = content;

				const sfcBlockReg = /\<(script)[\s\S]*?\>([\s\S]*?)\<\/\1\>/g;

				for (const match of newContent.matchAll(sfcBlockReg)) {
					if (match.index !== undefined) {
						const matchText = match[0];
						// ignore `<script src="...">`
						if (matchText.indexOf('src=') >= 0) {
							newContent = newContent.substring(0, match.index) + ' '.repeat(matchText.length) + newContent.substring(match.index + matchText.length);
						}
					}
				}

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

				newContent = newContent.replace(/<script>/g, '<vls-sr>');
				newContent = newContent.replace(/<\/script>/g, '</vls-sr>');

				return vueHtmlFilePlugin.compileFileToVue?.(fileName, newContent);
			};
		}
	};
}
