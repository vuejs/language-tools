<script setup lang="ts">
import Child from './Child.vue';

const items = [1, 2];
const ok = true;
function go(n: number) {
	return n;
}
</script>

<template lang="pug">
div.wrapper(:title="badProp" @click="badEvent()")
  p(v-if="badIf") a
  span(v-for="item in badSource" :key="item") {{ item }}
  span(v-for="alias in items" :key="alias") {{ alias.badAlias }}
  Child
    template(#default="{ badSlot }") {{ badSlot }}
  b(:a="badA" :b="badB") {{ badC }}
  p
    | text {{ badPiped }} text
  i(
    :x="ok"
    :y="badMultiLine"
  )
  em(v-if="ok" v-for="n in items") {{ go(n) }}
  .clean(class="x")
</template>
