import { startServer } from './lib/server';

if (process.argv.includes('--version')) {
	console.log(require('./package.json').version);
}
else {
	startServer();
}
