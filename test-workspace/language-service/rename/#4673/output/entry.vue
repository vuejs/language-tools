<script setup lang="ts">
import { useCssModule } from 'vue';

const $style = useCssModule();
const stylAlias = useCssModule('stylus');
</script>

<template>
    <div :class="stylus.foo">{{  }}</div>
            <!-- ^^^^rename: stylus -->
</template>

<style module>
.foo { }
</style>

<style module="stylus">
.foo { }
</style>