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
    fputs("Usage: type-to-terminal <terminal-pid> [--no-return] [--key <keyname>] <message>\n", stderr)
    exit(1)
}

guard let terminalPID = Int32(CommandLine.arguments[1]) else {
    fputs("Invalid PID\n", stderr)
    exit(1)
}

var args = Array(CommandLine.arguments.dropFirst(2))
var noReturn = false
var specialKey: String? = nil

// Parse flags
while !args.isEmpty {
    if args[0] == "--no-return" {
        noReturn = true
        args.removeFirst()
    } else if args[0] == "--key" && args.count >= 2 {
        args.removeFirst()
        specialKey = args.removeFirst()
    } else {
        break
    }
}

let message = args.joined(separator: " ")

// Map special key names to virtual keycodes
let keyCodeMap: [String: UInt16] = [
    "return": 0x24,
    "tab": 0x30,
    "escape": 0x35,
    "backspace": 0x33,
    "delete": 0x75,
    "up": 0x7E,
    "down": 0x7D,
    "left": 0x7B,
    "right": 0x7C,
]

func postKey(_ keyCode: UInt16, toPID pid: pid_t) {
    let source = CGEventSource(stateID: .hidSystemState)
    if let down = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true) {
        down.postToPid(pid)
    }
    if let up = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false) {
        up.postToPid(pid)
    }
}

// Post keyboard events to Terminal without activating it
func typeString(_ str: String, toPID pid: pid_t, appendReturn: Bool) {
    let source = CGEventSource(stateID: .hidSystemState)

    for char in str {
        let utf16 = Array(String(char).utf16)

        if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true) {
            keyDown.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: utf16)
            keyDown.postToPid(pid)
        }

        if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false) {
            keyUp.keyboardSetUnicodeString(stringLength: utf16.count, unicodeString: utf16)
            keyUp.postToPid(pid)
        }

        usleep(1000) // 1ms between chars
    }

    if appendReturn {
        usleep(5000)
        postKey(0x24, toPID: pid)
    }
}

// Handle special key mode
if let key = specialKey {
    if let code = keyCodeMap[key.lowercased()] {
        postKey(code, toPID: terminalPID)
    } else {
        fputs("Unknown key: \(key)\n", stderr)
        exit(1)
    }
} else {
    typeString(message, toPID: terminalPID, appendReturn: !noReturn)
}

print("ok")
