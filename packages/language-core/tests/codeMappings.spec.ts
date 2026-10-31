import { SpanMapKind } from '@volar/language-core';
import { expect, test } from 'vitest';
import { buildMappings } from '../lib/mappings/codeMappings';
import { navigationFeatures } from '../lib/mappings/features';
import type { IR, IRBlock } from '../lib/types';

const file = {} as IR;

test('maps each piece with a marker by itself', () => {
	expect(buildMappings([
		'<template>\n',
		{ source: file, start: 20, end: 23, data: { features: navigationFeatures }, text: 'abc' },
		'\n\n',
		{ source: file, start: 40, end: 40, data: { features: 0 }, text: '' },
		{
			source: { name: 'template', offset: 0 } as IRBlock,
			start: 5,
			end: 7,
			data: { features: 0, kind: SpanMapKind.Atom },
			text: 'de',
		},
	])).toEqual([
		{
			virtualStart: 11,
			virtualEnd: 14,
			originalStart: 20,
			originalEnd: 23,
			kind: SpanMapKind.Verbatim,
			features: navigationFeatures,
		},
		{ virtualStart: 16, virtualEnd: 16, originalStart: 40, originalEnd: 40, kind: SpanMapKind.Verbatim, features: 0 },
		{ virtualStart: 16, virtualEnd: 18, originalStart: 5, originalEnd: 7, kind: SpanMapKind.Atom, features: 0 },
	]);
});
