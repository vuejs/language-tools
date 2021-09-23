import * as path from 'upath';
import { defineTypeCheck } from '../utils/defineTypeCheck';

defineTypeCheck(path.resolve(__dirname, '../../testCases/typeChecks/emit_to.vue'), [
	{
		start: 19,
		end: 26,
		source: 'ts',
		code: 2322,
	},
	{
		start: 51,
		end: 57,
		source: 'ts',
		code: 2322,
	},
	{
		start: 160,
		end: 166,
		source: 'ts',
		code: 2345,
	},
	{
		start: 199,
		end: 205,
		source: 'ts',
		code: 2345,
	},
	{
		start: 329,
		end: 336,
		source: 'ts',
		code: 2345,
	},
	{
		start: 380,
		end: 387,
		source: 'ts',
		code: 2345,
	},
]);
