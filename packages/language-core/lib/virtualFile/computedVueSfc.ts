import type { SFCParseResult } from '@vue/compiler-sfc';
import { computed } from 'computeds';
import type * as ts from 'typescript';
import type { VueLanguagePluginReturn } from '../types';

export function computedVueSfc(
	plugins: VueLanguagePluginReturn[],
	fileName: string,
	languageId: string,
	snapshot: () => ts.IScriptSnapshot
) {

	let cache: {
		snapshot: ts.IScriptSnapshot,
		sfc: SFCParseResult,
		plugin: VueLanguagePluginReturn,
	} | undefined;

	return computed(() => {

		// incremental update
		if (cache?.plugin.updateSFC) {
			const change = snapshot().getChangeRange(cache.snapshot);
			if (change) {
				const newSfc = cache.plugin.updateSFC(cache.sfc, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: snapshot().getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					cache.snapshot = snapshot();
					// force dirty
					cache.sfc = JSON.parse(JSON.stringify(newSfc));
					return cache.sfc;
				}
			}
		}

		for (const plugin of plugins) {
			const sfc = plugin.parseSFC?.(fileName, snapshot().getText(0, snapshot().getLength()))
				?? plugin.parseSFC2?.(fileName, languageId, snapshot().getText(0, snapshot().getLength()));
			if (sfc) {
				if (!sfc.errors.length) {
					cache = {
						snapshot: snapshot(),
						sfc,
						plugin,
					};
				}
				return sfc;
			}
		}
	});
}
