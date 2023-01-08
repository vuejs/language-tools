import * as path from 'typesafe-path';

export function isFileInDir(fileName: path.OsPath | path.PosixPath, dir: path.OsPath | path.PosixPath) {
	const relative = path.relative(dir, fileName);
	return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
