<script setup lang="ts" generic="T">
// @experimentalDefinePropProposal=johnsonEdition
import { exactType } from '../../shared';

const a = defineProp<T>();
const b = defineProp<T>(undefined);
const c = defineProp<T>(undefined, false);
const d = defineProp<T>(undefined, true);

exactType(a.value, {} as T | undefined);
exactType(b.value, {} as T | undefined);
exactType(c.value, {} as T | undefined);
exactType(d.value, {} as T);
</script>

<template>
    {{ exactType(a, {} as T | undefined) }}
    {{ exactType(b, {} as T | undefined) }}
    {{ exactType(c, {} as T | undefined) }}
    <!-- {{ exactType(d, {} as T) }} -->
</template>
