import { SpanMapKind } from '@volar/language-core';
import { expect, test } from 'vitest';
import { buildMappings } from '../lib/mappings/codeMappings';
import { navigationFeatures } from '../lib/mappings/features';

test('maps each segment with a marker by itself', () => {
	expect(buildMappings([
		'<template>\n',
		['abc', undefined, 20, { features: navigationFeatures }],
		'\n\n',
		['', undefined, 40, { features: 0 }],
		['de', 'template', 5, { features: 0, kind: SpanMapKind.Atom }],
	])).toEqual([
		[11, 3, 20, 3, SpanMapKind.Verbatim, navigationFeatures],
		[16, 0, 40, 0, SpanMapKind.Verbatim, 0],
		[16, 2, 5, 2, SpanMapKind.Atom, 0],
	]);
});
