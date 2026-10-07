/**
 * Sensory OLED — live intensity displays for a 128x64 SSD1306 I2C OLED.
 * Made by Buinho FabLab for the Invisible Cartographies project.
 */

//% color="#534AB7" icon="" block="Sensory OLED" weight=90
//% groups='["Intensity", "Activity", "Display"]'
namespace sensoryOLED {
    const W = 128
    const H = 64
    let addr = 0x3C
    let ready = false
    let fb: Buffer = null
    let sent: Buffer = null

    // 5x7 font, ASCII 32..122, 5 column bytes per glyph (bit 0 = top)
    const FONT = hex`000000000000005F00000007000700147F147F14242A7F2A12231308646236495620500005030000001C2241000041221C002A1C7F1C2A08083E080800503000000808080808006060000020100804023E5149453E00427F4000426151494622414949361814127F1027454545393C4A49493101710905033649494936464949291E003636000000563600000814224100141414141400412214080201510906324979413E7C1211127C7F494949363E414141227F4141221C7F494949417F090909013E4149497A7F0808087F00417F41002040413F017F081422417F404040407F020C027F7F0408107F3E4141413E7F090909063E4151215E7F09192946264949493201017F01013F4040403F1F2040201F3F4038403F631408146307087008076151494543007F41410002040810200041417F0004020102044040404040000102040020545454787F484444383844444420384444487F3854545418087E0901020C5252523E7F0804047800447D40002040443D007F1028440000417F40007C041804787C0804047838444444387C14141408081414187C7C080404084854545420043F4440203C4040207C1C2040201C3C4030403C44281028440C5050503C4464544C44`

    // ---------- low level ----------

    function command(c: number): void {
        const b = pins.createBuffer(2)
        b[0] = 0x00
        b[1] = c
        pins.i2cWriteBuffer(addr, b)
    }

    function begin(): void {
        if (ready) return
        fb = pins.createBuffer(1024)
        sent = pins.createBuffer(1024)
        const seq = [0xAE, 0xD5, 0x80, 0xA8, 0x3F, 0xD3, 0x00, 0x40, 0x8D, 0x14,
            0x20, 0x00, 0xA1, 0xC8, 0xDA, 0x12, 0x81, 0xCF, 0xD9, 0xF1,
            0xDB, 0x40, 0xA4, 0xA6, 0x2E, 0xAF]
        for (let i = 0; i < seq.length; i++) command(seq[i])
        ready = true
        flushPages(true)
    }

    function flushPages(all: boolean): void {
        for (let p = 0; p < 8; p++) {
            const start = p * W
            let changed = all
            if (!changed) {
                for (let i = start; i < start + W; i++) {
                    if (fb[i] != sent[i]) { changed = true; break }
                }
            }
            if (!changed) continue
            const c = pins.createBuffer(7)
            c[0] = 0x00
            c[1] = 0x21; c[2] = 0; c[3] = W - 1
            c[4] = 0x22; c[5] = p; c[6] = p
            pins.i2cWriteBuffer(addr, c)
            for (let chunk = 0; chunk < W; chunk += 32) {
                const d = pins.createBuffer(33)
                d[0] = 0x40
                for (let i = 0; i < 32; i++) {
                    const v = fb[start + chunk + i]
                    d[i + 1] = v
                    sent[start + chunk + i] = v
                }
                pins.i2cWriteBuffer(addr, d)
            }
        }
    }

    function show(): void {
        begin()
        flushPages(false)
    }

    function clearBuffer(): void {
        begin()
        for (let i = 0; i < 1024; i++) fb[i] = 0
    }

    function pixel(x: number, y: number): void {
        x = Math.floor(x)
        y = Math.floor(y)
        if (x < 0 || x >= W || y < 0 || y >= H) return
        const i = (y >> 3) * W + x
        fb[i] = fb[i] | (1 << (y & 7))
    }

    function hline(x0: number, x1: number, y: number): void {
        for (let x = x0; x <= x1; x++) pixel(x, y)
    }

    function vline(x: number, y0: number, y1: number): void {
        if (y0 > y1) { const t = y0; y0 = y1; y1 = t }
        for (let y = y0; y <= y1; y++) pixel(x, y)
    }

    function rect(x: number, y: number, w: number, h: number): void {
        hline(x, x + w - 1, y)
        hline(x, x + w - 1, y + h - 1)
        vline(x, y, y + h - 1)
        vline(x + w - 1, y, y + h - 1)
    }

    function fillRect(x: number, y: number, w: number, h: number): void {
        for (let i = 0; i < w; i++) vline(x + i, y, y + h - 1)
    }

    function text(x: number, y: number, s: string): void {
        for (let k = 0; k < s.length; k++) {
            let code = s.charCodeAt(k)
            if (code < 32 || code > 122) code = 63
            const base = (code - 32) * 5
            for (let col = 0; col < 5; col++) {
                const bits = FONT[base + col]
                for (let row = 0; row < 8; row++) {
                    if (bits & (1 << row)) pixel(x + k * 6 + col, y + row)
                }
            }
        }
    }

    function textRight(xRight: number, y: number, s: string): void {
        text(xRight - s.length * 6 + 2, y, s)
    }

    function fmt(v: number): string {
        return "" + Math.round(v)
    }

    function scale(v: number, min: number, max: number, size: number): number {
        if (max == min) return 0
        let f = (v - min) / (max - min)
        if (f < 0) f = 0
        if (f > 1) f = 1
        return Math.round(f * size)
    }

    // ---------- intensity bar ----------

    let peakValue = -1000000
    let peakTime = 0

    /**
     * Draws a live horizontal bar that rises and falls with the value.
     * A peak marker remembers the highest value and slowly falls back.
     * Call it repeatedly, for example in a forever loop.
     * @param value the reading to show, eg: 50
     * @param min the value for an empty bar, eg: 30
     * @param max the value for a full bar, eg: 90
     * @param label the word shown top left, eg: "SOUND"
     * @param unit the unit shown after the value, eg: "dB"
     * @param peak show a peak marker, eg: true
     */
    //% blockId=sensoryoled_bar
    //% block="intensity bar $value from $min to $max||label $label unit $unit show peak $peak"
    //% value.defl=50 min.defl=30 max.defl=90 label.defl="SOUND" unit.defl="dB" peak.defl=true
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Intensity" weight=100
    export function intensityBar(value: number, min: number, max: number, label?: string, unit?: string, peak?: boolean): void {
        if (label === undefined || label === null) label = "SOUND"
        if (unit === undefined || unit === null) unit = "dB"
        if (peak === undefined || peak === null) peak = true
        const now = control.millis()
        const range = max - min
        if (peakTime > 0) {
            // the peak marker falls across the whole range in 3 seconds
            peakValue -= range * (now - peakTime) / 3000
        }
        peakTime = now
        if (value > peakValue) peakValue = value
        if (peakValue < min) peakValue = min

        clearBuffer()
        text(0, 0, label)
        textRight(W - 1, 0, fmt(value) + " " + unit)
        rect(0, 16, W, 24)
        const w = scale(value, min, max, W - 4)
        if (w > 0) fillRect(2, 18, w, 20)
        if (peak) {
            const px = 2 + scale(peakValue, min, max, W - 4)
            vline(Math.min(px, W - 2), 12, 43)
            vline(Math.min(px + 1, W - 1), 12, 43)
        }
        text(0, 52, fmt(min))
        textRight(W - 1, 52, fmt(max))
        if (peak) {
            const p = "PEAK " + fmt(peakValue)
            text(Math.round((W - p.length * 6) / 2), 52, p)
        }
        show()
    }

    // ---------- scrolling graph ----------

    let history: number[] = []

    /**
     * Draws the most recent readings as a line that scrolls from right to left.
     * Optional dotted lines mark two levels, for example calm and intense.
     * Call it repeatedly; each call adds one point.
     * @param value the reading to add, eg: 50
     * @param min the value at the bottom of the graph, eg: 30
     * @param max the value at the top of the graph, eg: 90
     * @param low a dotted guide line, eg: 45
     * @param high a second dotted guide line, eg: 65
     * @param label the word shown top left, eg: "SOUND"
     */
    //% blockId=sensoryoled_graph
    //% block="scrolling graph $value from $min to $max||lines at $low and $high label $label"
    //% value.defl=50 min.defl=30 max.defl=90 low.defl=45 high.defl=65 label.defl="SOUND"
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Intensity" weight=90
    export function scrollingGraph(value: number, min: number, max: number, low?: number, high?: number, label?: string): void {
        if (label === undefined || label === null) label = "SOUND"
        history.push(value)
        if (history.length > W) history.shift()

        const top = 10
        const size = H - 1 - top
        const yOf = (v: number) => H - 1 - scale(v, min, max, size)

        clearBuffer()
        text(0, 0, label)
        textRight(W - 1, 0, fmt(value))
        const guides = [low, high]
        for (let g = 0; g < 2; g++) {
            const gv = guides[g]
            if (gv === undefined || gv === null) continue
            if (gv <= min || gv >= max) continue
            const gy = yOf(gv)
            for (let x = 0; x < W; x += 4) pixel(x, gy)
        }
        const n = history.length
        let prevY = -1
        for (let i = 0; i < n; i++) {
            const x = W - n + i
            const y = yOf(history[i])
            if (prevY < 0) pixel(x, y)
            else vline(x, prevY, y)
            prevY = y
        }
        show()
    }

    /**
     * Clears the history of the scrolling graph.
     */
    //% blockId=sensoryoled_graph_reset block="reset scrolling graph"
    //% group="Intensity" weight=80
    export function resetGraph(): void {
        history = []
    }

    // ---------- sound in dB ----------

    /**
     * Converts the micro:bit V2 sound level (0-255) to approximate decibels.
     * The micro:bit maps 35 dB to 0 and 100 dB to 255, so the result is between 35 and 100.
     * Uncalibrated: good for comparing places, not for official measurements.
     * @param level the micro:bit sound level from 0 to 255, eg: 128
     */
    //% blockId=sensoryoled_db block="dB from sound level $level"
    //% level.min=0 level.max=255 level.defl=128
    //% group="Intensity" weight=70
    export function toDecibels(level: number): number {
        if (level < 0) level = 0
        if (level > 255) level = 255
        return Math.round(35 + level * 65 / 255)
    }

    // ---------- activity meter ----------

    let energy = 0
    let wasMoving = false
    let lastActivity = 0
    let moves: number[] = []

    /**
     * True while the PIR motion sensor on this pin detects movement.
     * @param pin the pin the PIR sensor is plugged into, eg: DigitalPin.P1
     */
    //% blockId=sensoryoled_pir block="PIR at $pin detects motion"
    //% pin.defl=DigitalPin.P1
    //% group="Activity" weight=60
    export function pirMotion(pin: DigitalPin): boolean {
        return pins.digitalReadPin(pin) == 1
    }

    function updateActivity(moving: boolean, seconds: number): void {
        const now = control.millis()
        const dt = lastActivity > 0 ? (now - lastActivity) / 1000 : 0
        lastActivity = now
        if (seconds <= 0) seconds = 1
        if (moving && !wasMoving) {
            energy += 25
            moves.push(now)
        }
        if (moving) energy += 10 * dt
        else energy -= 100 * dt / seconds
        if (energy > 100) energy = 100
        if (energy < 0) energy = 0
        wasMoving = moving
        while (moves.length > 0 && now - moves[0] > 60000) moves.shift()
    }

    /**
     * Shows a meter that fills up with each movement and empties when nothing moves.
     * Turns a yes/no motion signal into a level of activity.
     * Call it repeatedly, for example in a forever loop with a short pause.
     * @param moving true while movement is detected
     * @param seconds how long a full meter takes to empty, eg: 10
     * @param label the word shown top left, eg: "ACTIVITY"
     */
    //% blockId=sensoryoled_activity
    //% block="activity meter $moving||empty in $seconds s label $label"
    //% moving.shadow=sensoryoled_pir
    //% seconds.defl=10 label.defl="ACTIVITY"
    //% expandableArgumentMode="toggle" inlineInputMode=inline
    //% group="Activity" weight=100
    export function activityMeter(moving: boolean, seconds?: number, label?: string): void {
        if (seconds === undefined || seconds === null) seconds = 10
        if (label === undefined || label === null) label = "ACTIVITY"
        updateActivity(moving, seconds)

        clearBuffer()
        text(0, 0, label)
        textRight(W - 1, 0, moves.length + "/min")
        for (let i = 0; i < 10; i++) {
            const h = 8 + i * 4
            const x = 4 + i * 12
            const y = 60 - h
            if (energy > i * 10) fillRect(x, y, 9, h)
            else rect(x, y, 9, h)
        }
        show()
    }

    /**
     * The current activity level, from 0 to 100, as used by the activity meter.
     */
    //% blockId=sensoryoled_activity_level block="activity level"
    //% group="Activity" weight=50
    export function activityLevel(): number {
        return Math.round(energy)
    }

    /**
     * How many separate movements started in the last minute.
     */
    //% blockId=sensoryoled_moves block="movements per minute"
    //% group="Activity" weight=40
    export function movementsPerMinute(): number {
        return moves.length
    }

    // ---------- display ----------

    /**
     * Starts the OLED. Only needed if your display uses another I2C address.
     * @param address the I2C address, eg: 60
     */
    //% blockId=sensoryoled_init block="start OLED at address $address"
    //% address.defl=60
    //% group="Display" weight=30 advanced=true
    export function init(address: number): void {
        addr = address
        ready = false
        begin()
    }

    /**
     * Clears the display.
     */
    //% blockId=sensoryoled_clear block="clear OLED"
    //% group="Display" weight=20
    export function clear(): void {
        clearBuffer()
        show()
    }

    /**
     * Writes a short line of text (up to 21 characters) on one of 8 lines.
     * @param s the text to show, eg: "Hello"
     * @param line the line number from 0 (top) to 7 (bottom), eg: 0
     */
    //% blockId=sensoryoled_text block="show text $s on line $line"
    //% line.min=0 line.max=7 line.defl=0
    //% group="Display" weight=10
    export function showText(s: string, line: number): void {
        begin()
        const y = Math.max(0, Math.min(7, Math.round(line))) * 8
        for (let x = 0; x < W; x++) fb[(y >> 3) * W + x] = 0
        text(0, y, s)
        show()
    }
}
