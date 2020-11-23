import { effect, ReactiveEffect, ComputedGetter, trigger, ReactiveFlags, toRaw, TriggerOpTypes, track, TrackOpTypes, ComputedRef } from '@vue/reactivity'

class CheapComputed<T> {
    private _value!: T
    private _dirty = true

    public readonly effect: ReactiveEffect<T>

    public readonly __v_isRef = true
    public readonly [ReactiveFlags.IS_READONLY]: boolean

    constructor(
        getter: ComputedGetter<T>,
        isDirty: (oldValue: T) => boolean
    ) {
        this.effect = effect(getter, {
            lazy: true,
            scheduler: () => {
                if (!this._dirty && isDirty(this._value)) {
                    this._dirty = true
                    trigger(toRaw(this), TriggerOpTypes.SET, 'value')
                }
            }
        })

        this[ReactiveFlags.IS_READONLY] = true
    }

    get value() {
        if (this._dirty) {
            this._value = this.effect()
            this._dirty = false
        }
        track(toRaw(this), TrackOpTypes.GET, 'value')
        return this._value
    }
}

export function cheapComputed<T>(
    getter: ComputedGetter<T>,
    isDirty: (oldValue: T) => boolean
) {
    // @ts-ignore
    return new CheapComputed(getter, isDirty) as ComputedRef<T>
}