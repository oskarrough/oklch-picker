import {canvasFormat, build, fastFormat} from './lib/colors.ts'
import {getCleanCtx, initCanvasSize} from './lib/canvas.ts'

/** Base for channel controls: range slider + numeric input + optional canvas gradient */
abstract class OklchChannel extends HTMLElement {
	protected rangeInput!: HTMLInputElement
	protected numericInput!: HTMLInputElement
	protected canvas?: HTMLCanvasElement
	protected _value: number

	abstract label: string
	abstract min: number
	abstract max: number
	abstract step: number
	abstract numericStep: number
	abstract defaultValue: number
	abstract eventName: string

	constructor() {
		super()
		this._value = 0
		this.render()
		this.setupInputs()
	}

	static get observedAttributes() {
		return ['value']
	}

	attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		if (name === 'value' && oldValue !== newValue) {
			this._value = parseFloat(newValue) || this.defaultValue
			this.updateInputs()
		}
	}

	get value() {
		return this._value
	}

	set value(val: number) {
		this._value = this.clampValue(val)
		this.setAttribute('value', String(this._value))
		this.updateInputs()
		this.dispatchEvent(new CustomEvent(this.eventName, {
			detail: {value: this._value},
			bubbles: true
		}))
	}

	protected abstract clampValue(val: number): number
	protected abstract paintGradient(): void

	protected get hasCanvas() {
		return true
	}

	private render() {
		const value = this.getAttribute('value') || String(this.defaultValue)
		this._value = parseFloat(value)
		const labelId = `${this.label.toLowerCase()}-input`

		this.innerHTML = `
			<label for="${labelId}">${this.label}</label>
			<input type="number"
				id="${labelId}"
				min="${this.min}"
				max="${this.max}"
				step="${this.numericStep}"
				value="${value}">
			${this.hasCanvas ? '<canvas></canvas>' : ''}
			<input type="range"
				min="${this.min}"
				max="${this.max}"
				step="${this.step}"
				aria-labelledby="${labelId}"
				value="${value}"
				tabindex="-1">
		`
	}

	private setupInputs() {
		this.rangeInput = this.querySelector('input[type="range"]')!
		this.numericInput = this.querySelector('input[type="number"]')!
		if (this.hasCanvas) this.canvas = this.querySelector('canvas')!

		this.rangeInput.addEventListener('input', () => {
			this.value = parseFloat(this.rangeInput.value)
		})

		this.numericInput.addEventListener('input', () => {
			this.value = parseFloat(this.numericInput.value)
		})

		if (this.canvas) this.paintGradient()
	}

	private updateInputs() {
		if (!this.rangeInput || !this.numericInput) return

		this.rangeInput.value = String(this._value)
		if (parseFloat(this.numericInput.value) !== this._value) {
			this.numericInput.value = String(this._value)
		}

		if (this.canvas) this.paintGradient()
	}
}

class OklchLightness extends OklchChannel {
	label = 'Lightness'
	min = 0
	max = 1
	step = 0.0001
	numericStep = 0.01
	defaultValue = 0.7
	eventName = 'lightness-change'

	private _chroma = 0.1
	private _hue = 286

	protected clampValue(val: number) {
		return Math.max(0, Math.min(1, val))
	}

	protected paintGradient() {
		if (!this.canvas) return
		const [width, height] = initCanvasSize(this.canvas)
		const ctx = getCleanCtx(this.canvas)

		for (let x = 0; x <= width; x++) {
			const lightness = x / width
			const color = build(lightness, this._chroma, this._hue)
			ctx.fillStyle = canvasFormat(color)
			ctx.fillRect(x, 0, 1, height)
		}
	}

	setContext(chroma: number, hue: number) {
		this._chroma = chroma
		this._hue = hue
		this.paintGradient()
	}
}

class OklchChroma extends OklchChannel {
	label = 'Chroma'
	min = 0
	max = 0.37
	step = 0.0001
	numericStep = 0.01
	defaultValue = 0.1
	eventName = 'chroma-change'

	private _lightness = 0.7
	private _hue = 286

	protected clampValue(val: number) {
		return Math.max(0, Math.min(0.37, val))
	}

	protected paintGradient() {
		if (!this.canvas) return
		const [width, height] = initCanvasSize(this.canvas)
		const ctx = getCleanCtx(this.canvas)

		for (let x = 0; x <= width; x++) {
			const chroma = (0.37 * x) / width
			const color = build(this._lightness, chroma, this._hue)
			ctx.fillStyle = canvasFormat(color)
			ctx.fillRect(x, 0, 1, height)
		}
	}

	setContext(lightness: number, hue: number) {
		this._lightness = lightness
		this._hue = hue
		this.paintGradient()
	}
}

class OklchHue extends OklchChannel {
	label = 'Hue'
	min = 0
	max = 360
	step = 0.1
	numericStep = 1
	defaultValue = 286
	eventName = 'hue-change'

	private _lightness = 0.7
	private _chroma = 0.1

	protected clampValue(val: number) {
		return ((val % 360) + 360) % 360
	}

	protected paintGradient() {
		if (!this.canvas) return
		const [width, height] = initCanvasSize(this.canvas)
		const ctx = getCleanCtx(this.canvas)

		for (let x = 0; x <= width; x++) {
			const hue = (360 * x) / width
			const color = build(this._lightness, this._chroma, hue)
			ctx.fillStyle = canvasFormat(color)
			ctx.fillRect(x, 0, 1, height)
		}
	}

	setContext(lightness: number, chroma: number) {
		this._lightness = lightness
		this._chroma = chroma
		this.paintGradient()
	}
}

class OklchAlpha extends OklchChannel {
	label = 'Alpha'
	min = 0
	max = 1
	step = 0.001
	numericStep = 0.01
	defaultValue = 1
	eventName = 'alpha-change'

	protected get hasCanvas() {
		return false
	}

	protected clampValue(val: number) {
		return Math.max(0, Math.min(1, val))
	}

	protected paintGradient() {}
}

class OklchPicker extends HTMLElement {
	private lightnessControl!: OklchLightness
	private chromaControl!: OklchChroma
	private hueControl!: OklchHue
	private alphaControl!: OklchAlpha

	constructor() {
		super()
		this.render()
		this.setupControls()
	}

	static get observedAttributes() {
		return ['l', 'c', 'h', 'a', 'value']
	}

	attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		if (oldValue === newValue) return

		switch (name) {
			case 'l':
				if (this.lightnessControl) this.lightnessControl.value = parseFloat(newValue) || 0.7
				break
			case 'c':
				if (this.chromaControl) this.chromaControl.value = parseFloat(newValue) || 0.1
				break
			case 'h':
				if (this.hueControl) this.hueControl.value = parseFloat(newValue) || 286
				break
			case 'a':
				if (this.alphaControl) this.alphaControl.value = parseFloat(newValue) || 1
				break
			case 'value':
				this.parseOklchString(newValue)
				break
		}
	}

	get l() {
		return this.lightnessControl?.value || 0.7
	}
	get c() {
		return this.chromaControl?.value || 0.1
	}
	get h() {
		return this.hueControl?.value || 286
	}
	get a() {
		return this.alphaControl?.value || 1
	}

	get value() {
		return `oklch(${this.l} ${this.c} ${this.h} / ${this.a})`
	}

	set value(oklchString: string) {
		this.setAttribute('value', oklchString)
	}

	getValue() {
		return {l: this.l, c: this.c, h: this.h, a: this.a}
	}

	setValue(values: {l?: number; c?: number; h?: number; a?: number}) {
		if (values.l !== undefined) this.lightnessControl.value = values.l
		if (values.c !== undefined) this.chromaControl.value = values.c
		if (values.h !== undefined) this.hueControl.value = values.h
		if (values.a !== undefined) this.alphaControl.value = values.a
	}

	private render() {
		const l = this.getAttribute('l') || '0.7'
		const c = this.getAttribute('c') || '0.1'
		const h = this.getAttribute('h') || '286'
		const a = this.getAttribute('a') || '1'

		this.innerHTML = `
			<oklch-lightness value="${l}"></oklch-lightness>
			<oklch-chroma value="${c}"></oklch-chroma>
			<oklch-hue value="${h}"></oklch-hue>
			<oklch-alpha value="${a}"></oklch-alpha>
		`
	}

	private setupControls() {
		this.lightnessControl = this.querySelector('oklch-lightness')!
		this.chromaControl = this.querySelector('oklch-chroma')!
		this.hueControl = this.querySelector('oklch-hue')!
		this.alphaControl = this.querySelector('oklch-alpha')!

		this.updateAlphaGradient()

		this.addEventListener('lightness-change', (e: Event) => {
			const {value} = (e as CustomEvent<{value: number}>).detail
			this.setAttribute('l', String(value))
			this.chromaControl.setContext(value, this.h)
			this.hueControl.setContext(value, this.c)
			this.emitChange()
		})

		this.addEventListener('chroma-change', (e: Event) => {
			const {value} = (e as CustomEvent<{value: number}>).detail
			this.setAttribute('c', String(value))
			this.lightnessControl.setContext(value, this.h)
			this.hueControl.setContext(this.l, value)
			this.emitChange()
		})

		this.addEventListener('hue-change', (e: Event) => {
			const {value} = (e as CustomEvent<{value: number}>).detail
			this.setAttribute('h', String(value))
			this.lightnessControl.setContext(this.c, value)
			this.chromaControl.setContext(this.l, value)
			this.emitChange()
		})

		this.addEventListener('alpha-change', (e: Event) => {
			const {value} = (e as CustomEvent<{value: number}>).detail
			this.setAttribute('a', String(value))
			this.emitChange()
		})
	}

	private parseOklchString(value: string) {
		const match = value.match(/oklch\(([^)]+)\)/)
		if (!match) return

		const parts = match[1].split(/[\s\/]+/)
		if (parts.length >= 3) {
			this.setAttribute('l', parts[0] || '0.7')
			this.setAttribute('c', parts[1] || '0.1')
			this.setAttribute('h', parts[2] || '286')
			if (parts.length > 3) this.setAttribute('a', parts[3] || '1')
		}
	}

	private emitChange() {
		this.updateAlphaGradient()
		this.dispatchEvent(new CustomEvent('change', {
			detail: {
				l: this.l,
				c: this.c,
				h: this.h,
				a: this.a,
				value: this.value
			},
			bubbles: true
		}))
	}

	private updateAlphaGradient() {
		const color = build(this.l, this.c, this.h)
		this.style.setProperty('--range-a-from', fastFormat({...color, alpha: 0}))
		this.style.setProperty('--range-a-to', fastFormat({...color, alpha: 1}))
	}
}

customElements.define('oklch-lightness', OklchLightness)
customElements.define('oklch-chroma', OklchChroma)
customElements.define('oklch-hue', OklchHue)
customElements.define('oklch-alpha', OklchAlpha)
customElements.define('oklch-picker', OklchPicker)
