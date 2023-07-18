import { defineComponent } from "vue";

export const Foo = defineComponent((_: { foo: string; }) => ()=> { });

export const Bar = defineComponent((_: { bar?: number; }) => ()=> { });
