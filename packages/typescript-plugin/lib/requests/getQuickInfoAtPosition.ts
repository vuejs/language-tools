import { getProject } from '../utils';

export function getQuickInfoAtPosition(fileName: string, position: number) {

	const match = getProject(fileName);
	if (!match) {
		return;
	}

	const { info } = match;
	const languageService = info.languageService;

	return languageService.getQuickInfoAtPosition(fileName, position);
}
