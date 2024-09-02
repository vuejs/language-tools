<script lang="ts">
import { exactType } from '../../../passedFixtures/shared';

export default {
    setup() {
        return {
            exactType,
            a: 1
        }
    }
};
</script>

<template>
    {{ exactType(a, 1 as number) }}
</template>

<style module>
.foo { }
</style>