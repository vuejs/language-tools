import type { LanguageServicePlugin } from '@volar/language-service';
import type { Requests } from '@vue/typescript-plugin/lib/requests';
import { resolveEmbeddedCode } from '../utils';

export function create({ getMatchWarnings }: Requests): LanguageServicePlugin {
	return {
		name: 'vue-match-warnings',
		capabilities: { diagnosticProvider: { interFileDependencies: true, workspaceDiagnostics: false } },
		create(context) {
			return {
				async provideDiagnostics(document) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template' || !document.getText().includes('v-match')) {
						return;
					}
					const warnings = await getMatchWarnings(info.root.fileName);
					return warnings?.map(warning => ({
						range: { start: document.positionAt(warning.start), end: document.positionAt(warning.end) },
						severity: 2,
						code: 'V_MATCH_UNREACHABLE',
						source: 'vue',
						message: warning.message,
					}));
				},
			};
		},
	};
}
