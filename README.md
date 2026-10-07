# Sensory OLED

Live intensity displays for micro:bit with a 128x64 SSD1306 I2C OLED (the display in the ELECFREAKS Smart Science IoT Kit).

Made by Buinho FabLab for the Invisible Cartographies project: sensory mapping in museums with children and museum educators.

## Add it to MakeCode

1. Open [makecode.microbit.org](https://makecode.microbit.org) and start a project.
2. Click **Extensions**, paste `https://github.com/Buinho-Creative-Hub/IC-Oled` and press Enter.
3. A new purple **Sensory OLED** drawer appears.

Plug the OLED into an I2C port of the IoT:bit. Do not mix these blocks with another OLED extension in the same program: both would draw on the same screen.

## Blocks

**intensity bar** `value` from `min` to `max`
A bar that rises and falls with the value. A peak marker remembers the highest value and slowly falls back. Expand (+) to change the label, unit and peak.

**scrolling graph** `value` from `min` to `max`
The last 128 readings as a line that scrolls from right to left. Expand (+) to add two dotted guide lines, for example 45 and 65 dB for calm and intense.

**activity meter** `PIR at P1 detects motion`
Each movement fills the meter; when nothing moves it empties (10 s by default). Shows movements in the last minute. Also: `activity level` (0–100) and `movements per minute` to log with the datalogger.

**big number** `value`
One value in large digits in the middle of the screen, readable from a distance. Expand (+) for the label and unit.

**average of** `value` **over 5 s**
A steadier reading: the average of the last few seconds instead of the exact moment. Use one channel (1, 2 or 3) per sensor.

**dB from sound level** `level`
Converts the micro:bit V2 sound level (0-255) to approximate decibels (35-100 dB). Uncalibrated.

**Display:** `clear OLED`, `show text on line`, and `start OLED at address` (only if your display is not at address 60 = 0x3C).

Put any number in the value slot: the noise sensor, the light sensor, the Sonar:bit distance, the micro:bit's own `sound level` or `light level`.

## Example

```blocks
basic.forever(function () {
    sensoryOLED.intensityBar(input.soundLevel(), 0, 255, "SOUND", "")
    basic.pause(100)
})
```

The test program (`test.ts`) uses the micro:bit V2 microphone and switches between the three screens with button B.

## Licence

MIT. Buinho Creative Hub, Messejana, Portugal.

#### Metadata (used for search, rendering)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
