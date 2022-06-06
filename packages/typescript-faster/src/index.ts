import * as semver from 'semver';
import _47 from './4_7';

export function decorate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	host: ts.LanguageServiceHost,
	service: ts.LanguageService,
) {
	if (semver.gte(ts.version, '4.7.0')) {
		_47(ts, host, service);
	}
}
