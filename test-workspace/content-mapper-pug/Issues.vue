<script setup lang="ts">
import { ref, useSlots } from 'vue';
import Child from './Child.vue';
import Used from './Child.vue';

const msg = 'hello';
const chars = ref('HelloWorld');
const panel = ref<{ open(): void } | null>(null);
const langs = ['en', 'fr'];
const xxx = 'HEY';
const slots = useSlots();
const name = 'email';
const hasError = ref(false);
const errorMessage = 'error';
const warningMessage = 'warning';
const state = { type: 'active' };
const job = ref<{ progress?: { subProgress?: { length: number }[] } }>({});
function getNumber() {
	return 123;
}
</script>

<template lang="pug">
//- #118
div(
  :class="[ \
    'text-white', \
    'bg-black', \
  ]"
) Foo
//- #118 end
//- #1357
div {{ msg }}
//- #1357 end
//- #1604
span(v-for="char in chars") {{ char }}
//- #1604 end
//- #1723
Child(:name="name")
//- #1723 end
//- #2329
button(v-if="panel" @click="panel.open()")
//- #2329 end
//- #2413
div
  div(title="aaaaa" aria-label=`{
    "page": "measure",
    "action": "start"
  }`)
//- #2413 end
//- #2447
mixin test
  p(v-text="xxx")
+test
//- #2447 end
//- #3659
Used(msg="m")
//- #3659 end
//- #4335
Child(msg="m")
  template(v-slot:[mySlot]="slotProps" v-for="(_, mySlot) in $slots" :key="mySlot")
    slot(:name="mySlot" v-bind="slotProps")
//- #4335 end
//- #50
div(v-for="lang in langs")
  span.foo {{ lang }}
  span.bar.baz {{ lang }}
//- #50 end
//- #5099
div.foo(class="bar")
//- #5099 end
//- #5899
Child(msg="m" :name="name")
  template(v-if="hasError" #errorMessage)
    slot(v-if="hasError" name="errorMessage")
      | {{ errorMessage }}
    span.pe-input__warning-message(v-else :title="`${name}Warning`") {{ warningMessage }}
//- #5899 end
//- #5914
Child(msg="m" class="foo")
  template(v-if="true" #help)
    | {{ getNumber() }}
//- #5914 end
//- #5921
Child(msg="m")
  //- Automatically passing slots does NOT work. We need to manually delegate all slots here.
  template(v-for="(_, slotName) in slots", #[slotName]="slotProps")
    slot(v-bind="slotProps", :name="slotName")
//- #5921 end
//- #5922
div
  template(v-if="job.progress")
    template(v-if="job.progress.subProgress")
      template(v-if="job.progress.subProgress.length > 0") x
  template(v-if="job.progress && job.progress.subProgress && job.progress.subProgress.length > 0") y
//- #5922 end
//- #5970
span(
  :class=`[
    "my-class",
    {
      "my-class--active": (state.type === 'active')
    }
  ]`
)
//- #5970 end
</template>
