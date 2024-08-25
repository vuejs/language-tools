<script setup lang="ts">
// @experimentalDefinePropProposal=kevinEdition
import { exactType } from '../../shared';

interface Qux { qux: true };

const foo = defineProp<string>('foo');
const bar = defineProp<string>('bar', {
    type: String,
    required: true,
    default: 'bar',
});
const baz = defineProp<string | number>('baz', {
    required: true,
    default: () => [1, 2, 3],
});
defineProp<Qux>('qux')
defineProp<boolean>('quux', { default: true })

// infer prop name from variable name
const quuz = defineProp<{}>();
console.log(quuz);
</script>

<template>
    {{ exactType(foo, {} as string | undefined) }}
    {{ exactType(bar, {} as string) }}
    {{ exactType(baz, {} as string | number) }}
    {{ exactType(qux, {} as Qux | undefined) }}
    {{ exactType(quux, {} as boolean | undefined) }}
    {{ exactType($props.quuz, {} as {} | undefined) }}
</template>
