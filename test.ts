input.onButtonPressed(Button.A, function () {
    sensoryOLED.resetGraph()
})
let mode = 0
input.onButtonPressed(Button.B, function () {
    mode = (mode + 1) % 3
})
basic.forever(function () {
    const s = input.soundLevel()
    if (mode == 0) sensoryOLED.intensityBar(s, 0, 255, "SOUND", "")
    else if (mode == 1) sensoryOLED.scrollingGraph(s, 0, 255, 80, 160)
    else sensoryOLED.activityMeter(sensoryOLED.pirMotion(DigitalPin.P1))
    basic.pause(100)
})
