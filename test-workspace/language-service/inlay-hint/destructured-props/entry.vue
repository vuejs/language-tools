<script setup lang="ts">
// @ts-nocheck
import { watch } from 'vue';

const { foo, bar, ...props } = defineProps<{
  foo: string;
  bar: string;
  baz: string;
}>();

type foo = foo[string] & typeof foo;
                             // ^inlayHint: "props."

interface foo extends (typeof foo) {
                           // ^inlayHint: "props."
  foo: string;
  foo(foo: string): void;
  foo: (foo: string) => void;
}

const obj = {
  foo: foo,
    // ^inlayHint: "props."
  [foo]: '',
// ^inlayHint: "props."
  foo,
  // ^inlayHint: ": props.foo"
  foo(foo) {},
  foo: function(foo) {},
  get bar() { return this.foo; },
  set bar(val) { this.foo = val; }
}

function func(foo) {}

class cls {
  foo: string = foo;
             // ^inlayHint: "props."
  constructor(foo) {}
}

for (const char of foo) {}
                // ^inlayHint: "props."

try {} catch (foo) {}

watch(() => foo, (foo) => {
         // ^inlayHint: "props."
  console.log(foo, bar, props.baz);
                // ^inlayHint: "props."
});
</script>