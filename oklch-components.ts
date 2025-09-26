// Import core utilities we'll need for custom elements
import { canvasFormat, build, fastFormat } from './lib/colors.ts'
import { getCleanCtx, initCanvasSize } from './lib/canvas.ts'

console.log('Test elements loading...')

/**
 * Reusable numeric input with increment/decrement buttons
 */
class NumericInput extends HTMLElement {
  private input!: HTMLInputElement
  private _value: number = 0
  private _min: number = 0
  private _max: number = 1
  private _step: number = 0.01

  constructor() {
    super()
    this.render()
    this.setupInput()
  }

  static get observedAttributes() {
    return ['value', 'min', 'max', 'step', 'label', 'id']
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return

    switch (name) {
      case 'value':
        this._value = parseFloat(newValue) || 0
        this.updateInput()
        break
      case 'min':
        this._min = parseFloat(newValue) || 0
        break
      case 'max':
        this._max = parseFloat(newValue) || 1
        break
      case 'step':
        this._step = parseFloat(newValue) || 0.01
        break
      case 'label':
      case 'id':
        this.render()
        break
    }
  }

  get value() {
    return this._value
  }

  set value(val: number) {
    this._value = Math.max(this._min, Math.min(this._max, val))
    this.setAttribute('value', String(this._value))
    this.updateInput()
    this.dispatchEvent(new CustomEvent('input', {
      detail: { value: this._value },
      bubbles: true
    }))
  }

  private render() {
    const label = this.getAttribute('label') || 'Value'
    const id = this.getAttribute('id') || 'numeric-input'
    const value = this.getAttribute('value') || '0'
    const min = this.getAttribute('min') || '0'
    const max = this.getAttribute('max') || '1'
    const step = this.getAttribute('step') || '0.01'

    this.innerHTML = `
      <label for="${id}">
        ${label}
        <input id="${id}"
          type="text"
          role="spinbutton"
          aria-valuemin="${min}"
          aria-valuemax="${max}"
          pattern="^[0-9+\\/*.\\-]+$"
          inputmode="decimal"
          step="${step}"
          value="${value}">
        <button type="button" data-action="increase" tabindex="-1" aria-hidden="true">+</button>
        <button type="button" data-action="decrease" tabindex="-1" aria-hidden="true">-</button>
      </label>
    `
  }

  private setupInput() {
    this.input = this.querySelector('input[type="text"]')!

    // Text input
    this.input.addEventListener('input', () => {
      const val = parseFloat(this.input.value)
      if (!isNaN(val) && val >= this._min && val <= this._max) {
        this.value = val
      }
    })

    // Increase/decrease buttons
    this.querySelector('button[data-action="increase"]')?.addEventListener('click', () => {
      this.value = Math.min(this._max, this.value + this._step)
    })

    this.querySelector('button[data-action="decrease"]')?.addEventListener('click', () => {
      this.value = Math.max(this._min, this.value - this._step)
    })
  }

  private updateInput() {
    if (this.input) {
      this.input.value = String(this._value)
    }
  }
}

/**
 * We have five components:
 * each channel: OklchLightness, OklchChrome, Oklchhue OklchAlpha
 * and the composing element: OklchPicker
 */

class OklchLightness extends HTMLElement {
  private rangeInput!: HTMLInputElement
  private numericInput!: NumericInput
  private canvas!: HTMLCanvasElement
  private _value: number = 0.7
  private _chroma: number = 0.1  // For gradient painting
  private _hue: number = 286     // For gradient painting

  constructor() {
    super()
    this.render()
    this.setupInputs()
  }

  static get observedAttributes() {
    return ['value']
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'value' && oldValue !== newValue) {
      this._value = parseFloat(newValue) || 0.7
      this.updateInputs()
    }
  }

  get value() {
    return this._value
  }

  set value(val: number) {
    this._value = Math.max(0, Math.min(1, val))
    this.setAttribute('value', String(this._value))
    this.updateInputs()
    this.dispatchEvent(new CustomEvent('lightness-change', {
      detail: { value: this._value },
      bubbles: true
    }))
  }

  private render() {
    const value = this.getAttribute('value') || '0.7'
    this._value = parseFloat(value)

    this.innerHTML = `
      <numeric-input
        id="lightness-input"
        label="Lightness"
        value="${value}"
        min="0"
        max="1"
        step="0.01">
      </numeric-input>
      <canvas></canvas>
      <input type="range"
        min="0"
        max="1"
        step="0.0001"
        aria-labelledby="lightness-input"
        value="${value}"
        tabindex="-1">
    `
  }

  private setupInputs() {
    this.rangeInput = this.querySelector('input[type="range"]')!
    this.numericInput = this.querySelector('numeric-input')!
    this.canvas = this.querySelector('canvas')!

    // Range slider input
    this.rangeInput.addEventListener('input', () => {
      this.value = parseFloat(this.rangeInput.value)
    })

    // Numeric input
    this.numericInput.addEventListener('input', (e: Event) => {
      const customEvent = e as CustomEvent<{value: number}>
      this.value = customEvent.detail.value
    })

    // Initial gradient paint
    this.paintGradient()
  }

  private updateInputs() {
    if (this.rangeInput && this.numericInput) {
      this.rangeInput.value = String(this._value)
      // Only update if different to prevent recursion
      if (this.numericInput.value !== this._value) {
        this.numericInput.value = this._value
      }
    }
  }

  private paintGradient() {
    if (!this.canvas) return

    const [width, height] = initCanvasSize(this.canvas)
    const ctx = getCleanCtx(this.canvas)

    // Paint lightness gradient from 0 to 1, using current chroma and hue
    for (let x = 0; x <= width; x++) {
      const lightness = x / width // 0 to 1
      const color = build(lightness, this._chroma, this._hue)
      ctx.fillStyle = canvasFormat(color)
      ctx.fillRect(x, 0, 1, height)
    }
  }

  // Method to update chroma/hue for gradient repainting
  setContext(chroma: number, hue: number) {
    this._chroma = chroma
    this._hue = hue
    this.paintGradient()
  }
}

class OklchChroma extends HTMLElement {
  private rangeInput!: HTMLInputElement
  private numericInput!: NumericInput
  private canvas!: HTMLCanvasElement
  private _value: number = 0.1
  private _lightness: number = 0.7  // For gradient painting
  private _hue: number = 286        // For gradient painting

  constructor() {
    super()
    this.render()
    this.setupInputs()
  }

  static get observedAttributes() {
    return ['value']
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'value' && oldValue !== newValue) {
      this._value = parseFloat(newValue) || 0.1
      this.updateInputs()
    }
  }

  get value() {
    return this._value
  }

  set value(val: number) {
    this._value = Math.max(0, Math.min(0.37, val))
    this.setAttribute('value', String(this._value))
    this.updateInputs()
    this.dispatchEvent(new CustomEvent('chroma-change', {
      detail: { value: this._value },
      bubbles: true
    }))
  }

  private render() {
    const value = this.getAttribute('value') || '0.1'
    this._value = parseFloat(value)

    this.innerHTML = `
      <numeric-input
        id="chroma-input"
        label="Chroma"
        value="${value}"
        min="0"
        max="0.37"
        step="0.01">
      </numeric-input>
      <canvas></canvas>
      <input type="range"
        min="0"
        max="0.37"
        step="0.0001"
        aria-labelledby="chroma-input"
        value="${value}"
        tabindex="-1">
    `
  }

  private setupInputs() {
    this.rangeInput = this.querySelector('input[type="range"]')!
    this.numericInput = this.querySelector('numeric-input')!
    this.canvas = this.querySelector('canvas')!

    // Range slider input
    this.rangeInput.addEventListener('input', () => {
      this.value = parseFloat(this.rangeInput.value)
    })

    // Numeric input
    this.numericInput.addEventListener('input', (e: Event) => {
      const customEvent = e as CustomEvent<{value: number}>
      this.value = customEvent.detail.value
    })

    // Initial gradient paint
    this.paintGradient()
  }

  private updateInputs() {
    if (this.rangeInput && this.numericInput) {
      this.rangeInput.value = String(this._value)
      // Only update if different to prevent recursion
      if (this.numericInput.value !== this._value) {
        this.numericInput.value = this._value
      }
    }
  }

  private paintGradient() {
    if (!this.canvas) return

    const [width, height] = initCanvasSize(this.canvas)
    const ctx = getCleanCtx(this.canvas)

    // Paint chroma gradient from 0 to 0.37, using current lightness and hue
    for (let x = 0; x <= width; x++) {
      const chroma = (0.37 * x) / width // 0 to 0.37
      const color = build(this._lightness, chroma, this._hue)
      ctx.fillStyle = canvasFormat(color)
      ctx.fillRect(x, 0, 1, height)
    }
  }

  // Method to update lightness/hue for gradient repainting
  setContext(lightness: number, hue: number) {
    this._lightness = lightness
    this._hue = hue
    this.paintGradient()
  }
}

class OklchHue extends HTMLElement {
  private rangeInput!: HTMLInputElement
  private numericInput!: NumericInput
  private canvas!: HTMLCanvasElement
  private _value: number = 286
  private _lightness: number = 0.7  // For gradient painting
  private _chroma: number = 0.1     // For gradient painting

  constructor() {
    super()
    this.render()
    this.setupInputs()
  }

  static get observedAttributes() {
    return ['value']
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'value' && oldValue !== newValue) {
      this._value = parseFloat(newValue) || 286
      this.updateInputs()
    }
  }

  get value() {
    return this._value
  }

  set value(val: number) {
    // Normalize hue to 0-360 range
    this._value = ((val % 360) + 360) % 360
    this.setAttribute('value', String(this._value))
    this.updateInputs()
    this.dispatchEvent(new CustomEvent('hue-change', {
      detail: { value: this._value },
      bubbles: true
    }))
  }

  private render() {
    const value = this.getAttribute('value') || '286'
    this._value = parseFloat(value)

    this.innerHTML = `
      <numeric-input
        id="hue-input"
        label="Hue"
        value="${value}"
        min="0"
        max="360"
        step="1">
      </numeric-input>
      <canvas></canvas>
      <input type="range"
        min="0"
        max="360"
        step="0.1"
        aria-labelledby="hue-input"
        value="${value}"
        tabindex="-1">
    `
  }

  private setupInputs() {
    this.rangeInput = this.querySelector('input[type="range"]')!
    this.numericInput = this.querySelector('numeric-input')!
    this.canvas = this.querySelector('canvas')!

    // Range slider input
    this.rangeInput.addEventListener('input', () => {
      this.value = parseFloat(this.rangeInput.value)
    })

    // Numeric input
    this.numericInput.addEventListener('input', (e: Event) => {
      const customEvent = e as CustomEvent<{value: number}>
      this.value = customEvent.detail.value
    })

    // Initial gradient paint
    this.paintGradient()
  }

  private updateInputs() {
    if (this.rangeInput && this.numericInput) {
      this.rangeInput.value = String(this._value)
      // Only update if different to prevent recursion
      if (this.numericInput.value !== this._value) {
        this.numericInput.value = this._value
      }
    }
  }

  private paintGradient() {
    if (!this.canvas) return

    const [width, height] = initCanvasSize(this.canvas)
    const ctx = getCleanCtx(this.canvas)

    // Paint hue gradient from 0 to 360, using current lightness and chroma
    for (let x = 0; x <= width; x++) {
      const hue = (360 * x) / width // 0 to 360
      const color = build(this._lightness, this._chroma, hue)
      ctx.fillStyle = canvasFormat(color)
      ctx.fillRect(x, 0, 1, height)
    }
  }

  // Method to update lightness/chroma for gradient repainting
  setContext(lightness: number, chroma: number) {
    this._lightness = lightness
    this._chroma = chroma
    this.paintGradient()
  }
}

class OklchAlpha extends HTMLElement {
  private rangeInput!: HTMLInputElement
  private numericInput!: NumericInput
  private rangeInputElement!: HTMLInputElement
  private _value: number = 1
  private _lightness: number = 0.7  // For gradient painting
  private _chroma: number = 0.1     // For gradient painting
  private _hue: number = 286        // For gradient painting

  constructor() {
    super()
    this.render()
    this.setupInputs()
  }

  static get observedAttributes() {
    return ['value']
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'value' && oldValue !== newValue) {
      this._value = parseFloat(newValue) || 1
      this.updateInputs()
    }
  }

  get value() {
    return this._value
  }

  set value(val: number) {
    this._value = Math.max(0, Math.min(1, val))
    this.setAttribute('value', String(this._value))
    this.updateInputs()
    this.dispatchEvent(new CustomEvent('alpha-change', {
      detail: { value: this._value },
      bubbles: true
    }))
  }

  private render() {
    const value = this.getAttribute('value') || '1'
    this._value = parseFloat(value)

    this.innerHTML = `
      <numeric-input
        id="alpha-input"
        label="Alpha"
        value="${value}"
        min="0"
        max="1"
        step="0.01">
      </numeric-input>
      <input type="range"
        min="0"
        max="1"
        step="0.001"
        aria-labelledby="alpha-input"
        value="${value}"
        tabindex="-1">
    `
  }

  private setupInputs() {
    this.rangeInput = this.querySelector('input[type="range"]')!
    this.numericInput = this.querySelector('numeric-input')!
    this.rangeInputElement = this.rangeInput

    // Range slider input
    this.rangeInput.addEventListener('input', () => {
      this.value = parseFloat(this.rangeInput.value)
    })

    // Numeric input
    this.numericInput.addEventListener('input', (e: Event) => {
      const customEvent = e as CustomEvent<{value: number}>
      this.value = customEvent.detail.value
    })

    // Initial gradient paint
    this.paintGradient()
  }

  private updateInputs() {
    if (this.rangeInput && this.numericInput) {
      this.rangeInput.value = String(this._value)
      // Only update if different to prevent recursion
      if (this.numericInput.value !== this._value) {
        this.numericInput.value = this._value
      }
    }
  }

  private paintGradient() {
    if (!this.rangeInputElement) return

    // Build the current color without alpha
    const color = build(this._lightness, this._chroma, this._hue)

    // Set CSS custom properties for alpha gradient
    this.rangeInputElement.style.setProperty('--range-a-from', fastFormat({ ...color, alpha: 0 }))
    this.rangeInputElement.style.setProperty('--range-a-to', fastFormat({ ...color, alpha: 1 }))
  }

  // Method to update L/C/H for gradient repainting
  setContext(lightness: number, chroma: number, hue: number) {
    this._lightness = lightness
    this._chroma = chroma
    this._hue = hue
    this.paintGradient()
  }
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

  get l() { return this.lightnessControl?.value || 0.7 }
  get c() { return this.chromaControl?.value || 0.1 }
  get h() { return this.hueControl?.value || 286 }
  get a() { return this.alphaControl?.value || 1 }

  get value() {
    return `oklch(${this.l} ${this.c} ${this.h} / ${this.a})`
  }

  set value(oklchString: string) {
    this.setAttribute('value', oklchString)
  }

  getValue() {
    return { l: this.l, c: this.c, h: this.h, a: this.a }
  }

  setValue(values: { l?: number; c?: number; h?: number; a?: number }) {
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

    // Listen for changes from child controls
    this.addEventListener('lightness-change', (e: Event) => {
      const customEvent = e as CustomEvent<{value: number}>
      this.setAttribute('l', String(customEvent.detail.value))
      // Update other gradients when lightness changes
      this.chromaControl.setContext(customEvent.detail.value, this.h)
      this.hueControl.setContext(customEvent.detail.value, this.c)
      this.alphaControl.setContext(customEvent.detail.value, this.c, this.h)
      this.emitChange()
    })

    this.addEventListener('chroma-change', (e: Event) => {
      const customEvent = e as CustomEvent<{value: number}>
      this.setAttribute('c', String(customEvent.detail.value))
      // Update other gradients when chroma changes
      this.lightnessControl.setContext(customEvent.detail.value, this.h)
      this.hueControl.setContext(this.l, customEvent.detail.value)
      this.alphaControl.setContext(this.l, customEvent.detail.value, this.h)
      this.emitChange()
    })

    this.addEventListener('hue-change', (e: Event) => {
      const customEvent = e as CustomEvent<{value: number}>
      this.setAttribute('h', String(customEvent.detail.value))
      // Update other gradients when hue changes
      this.lightnessControl.setContext(this.c, customEvent.detail.value)
      this.chromaControl.setContext(this.l, customEvent.detail.value)
      this.alphaControl.setContext(this.l, this.c, customEvent.detail.value)
      this.emitChange()
    })

    this.addEventListener('alpha-change', (e: Event) => {
      const customEvent = e as CustomEvent<{value: number}>
      this.setAttribute('a', String(customEvent.detail.value))
      this.emitChange()
    })
  }

  private parseOklchString(value: string) {
    // Simple parser for "oklch(l c h / a)" format
    const match = value.match(/oklch\(([^)]+)\)/)
    if (match) {
      const parts = match[1].split(/[\s\/]+/)
      if (parts.length >= 3) {
        this.setAttribute('l', parts[0] || '0.7')
        this.setAttribute('c', parts[1] || '0.1')
        this.setAttribute('h', parts[2] || '286')
        if (parts.length > 3) this.setAttribute('a', parts[3] || '1')
      }
    }
  }

  private emitChange() {
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
}

// Register all custom elements
customElements.define('numeric-input', NumericInput)
customElements.define('oklch-lightness', OklchLightness)
customElements.define('oklch-chroma', OklchChroma)
customElements.define('oklch-hue', OklchHue)
customElements.define('oklch-alpha', OklchAlpha)
customElements.define('oklch-picker', OklchPicker)

console.log('Custom elements registered successfully!')

// Test the API
;(window as any).testAPI = () => {
  const picker = document.querySelector('oklch-picker') as OklchPicker
  const output = document.getElementById('output')!

  // Test getting current value
  console.log('Current value:', picker.value)
  console.log('Individual components:', picker.getValue())

  // Test setting new values
  picker.setValue({ l: 0.5, c: 0.2, h: 180, a: 0.8 })

  output.textContent = picker.value
}

// Listen for changes
document.addEventListener('change', (e) => {
  if (e.target instanceof OklchPicker) {
    console.log('Color picker changed:', e.detail)
  }
})
