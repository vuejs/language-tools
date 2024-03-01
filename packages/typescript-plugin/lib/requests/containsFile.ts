import { getProject } from '../utils';

export function containsFile(fileName: string) {
	return !!getProject(fileName);
}
