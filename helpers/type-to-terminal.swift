#!/usr/bin/env swift

// type-to-terminal: Sends text to Terminal.app without stealing focus.
// Usage: type-to-terminal <pid-of-terminal> <message>
//
// Uses CGEvent.postToPid() to send keyboard events directly to
// Terminal.app's process without activating it.

import Foundation
import AppKit
import ApplicationServices

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: type-to-terminal <terminal-pid> <message>\n", stderr)
    exit(1)
}

guard let terminalPID = Int32(CommandLine.arguments[1]) else {
    fputs("Invalid PID\n", stderr)
    exit(1)
}

let message = CommandLine.arguments.dropFirst(2).joined(separator: " ")

// Post keyboard events to Terminal without activating it
func typeString(_ str: String, toPID pid: pid_t) {
    let source = CGEventSource(stateID: .hidSystemState)

    for char in str {
        let utf16 = Array(String(char).utf16)

        // Key down
        if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true) {
            keyDown.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: utf16)
            keyDown.postToPid(pid)
        }

        // Key up
        if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false) {
            keyUp.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: utf16)
            keyUp.postToPid(pid)
        }

        // Tiny delay between chars for reliability
        usleep(1000) // 1ms
    }

    // Press Return (keycode 0x24 = 36)
    usleep(5000) // 5ms pause before return
    if let returnDown = CGEvent(keyboardEventSource: source, virtualKey: 0x24, keyDown: true) {
        returnDown.postToPid(pid)
    }
    if let returnUp = CGEvent(keyboardEventSource: source, virtualKey: 0x24, keyDown: false) {
        returnUp.postToPid(pid)
    }
}

typeString(message, toPID: terminalPID)
print("ok")
