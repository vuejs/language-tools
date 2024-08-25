import { type Directive } from 'vue';

export const vFocus: Directive<HTMLInputElement> = {
  mounted(el) {
    el.focus();
  }
};
