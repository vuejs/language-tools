<script setup lang="ts">
// @experimentalDefinePropProposal=johnsonEdition
import { exactType } from '../../shared';

const a = defineProp<string>();
const b = defineProp('', true);
const c = defineProp(1, true);
const d = defineProp(1, false);
const e = defineProp<string>(undefined);
const f = defineProp<string>(undefined, true);
const g = defineProp<string>(undefined, false);
</script>

<template>
    {{ exactType(a, {} as string | undefined) }}
    {{ exactType(b, {} as string) }}
    {{ exactType(c, {} as number) }}
    {{ exactType(d, {} as number) }}
    {{ exactType(e, {} as string | undefined) }}
    {{ exactType(f, {} as string) }}
    {{ exactType(g, {} as string | undefined) }}
</template>
