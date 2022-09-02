<script lang="ts" setup>
const foo = 1;
   // ^^^rename: bar
</script>

<style>
/* .bar { color: v-bind(foo); } */
.bar { color: v-bind(foo); }
                  /* ^^^rename: bar */
.bar { color: v-bind('foo'); }
.bar { color: v-bind("foo"); }
.bar { color: v-bind(foo + foo); }
.bar { color: v-bind('foo + foo'); }
.bar { color: v-bind("foo + foo"); }
.bar { color: v-bind(); }
</style>

<style lang="scss">
// .bar { color: v-bind(foo); }
</style>