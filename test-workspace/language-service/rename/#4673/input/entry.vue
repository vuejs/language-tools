<script setup lang="ts">
import { useCssModule } from 'vue';

const $style = useCssModule();
const stylAlias = useCssModule('styl');
</script>

<template>
    <div :class="styl.foo">{{  }}</div>
            <!-- ^^^^rename: stylus -->
</template>

<style module>
.foo { }
</style>

<style module="styl">
.foo { }
</style>