<script lang="ts" setup>
const bar = 1;
   // ^^^rename: bar
</script>

<style>
/* .bar { color: v-bind(foo); } */
.bar { color: v-bind(bar); }
                  /* ^^^rename: bar */
.bar { color: v-bind('bar'); }
.bar { color: v-bind("bar"); }
.bar { color: v-bind(bar + bar); }
.bar { color: v-bind('bar + bar'); }
.bar { color: v-bind("bar + bar"); }
.bar { color: v-bind(); }
</style>

<style lang="scss">
// .bar { color: v-bind(foo); }
</style>