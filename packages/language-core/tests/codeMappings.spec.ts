import { SpanMapKind } from '@volar/language-core';
import { expect, test } from 'vitest';
import { buildMappings } from '../lib/mappings/codeMappings';
import { navigationFeatures } from '../lib/mappings/features';
import type { IRBlock } from '../lib/types';

test('maps each segment with a marker by itself', () => {
	expect(buildMappings([
		'<template>\n',
		['abc', undefined, 20, { features: navigationFeatures }],
		'\n\n',
		['', undefined, 40, { features: 0 }],
		['de', { name: 'template', offset: 0 } as IRBlock, 5, { features: 0, kind: SpanMapKind.Atom }],
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
