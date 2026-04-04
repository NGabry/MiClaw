#!/usr/bin/env python3
"""Read Terminal.app's full ANSI color palette from plist preferences."""

import plistlib
import json
import os
import sys

def decode_nscolor(data_bytes):
    try:
        obj = plistlib.loads(data_bytes)
        objects = obj.get("$objects", [])
        for o in objects:
            if isinstance(o, dict) and "NSRGB" in o:
                rgb_str = o["NSRGB"]
                if isinstance(rgb_str, bytes):
                    rgb_str = rgb_str.decode("ascii").replace("\x00", "").strip()
                parts = rgb_str.split()
                r, g, b = [int(float(x) * 255) for x in parts[:3]]
                return f"#{r:02x}{g:02x}{b:02x}"
            if isinstance(o, dict) and "NSWhite" in o:
                w_str = o["NSWhite"]
                if isinstance(w_str, bytes):
                    w_str = w_str.decode("ascii").replace("\x00", "").strip()
                w = int(float(w_str.split()[0]) * 255)
                return f"#{w:02x}{w:02x}{w:02x}"
    except Exception:
        pass
    return None


plist_path = os.path.expanduser("~/Library/Preferences/com.apple.Terminal.plist")

with open(plist_path, "rb") as f:
    data = plistlib.load(f)

profile_name = data.get("Default Window Settings", "Default")
profile = data.get("Window Settings", {}).get(profile_name, {})

keys_map = {
    "BackgroundColor": "background",
    "TextColor": "foreground",
    "TextBoldColor": "bold",
    "SelectionColor": "selection",
    "ANSIBlackColor": "black",
    "ANSIRedColor": "red",
    "ANSIGreenColor": "green",
    "ANSIYellowColor": "yellow",
    "ANSIBlueColor": "blue",
    "ANSIMagentaColor": "magenta",
    "ANSICyanColor": "cyan",
    "ANSIWhiteColor": "white",
    "ANSIBrightBlackColor": "brightBlack",
    "ANSIBrightRedColor": "brightRed",
    "ANSIBrightGreenColor": "brightGreen",
    "ANSIBrightYellowColor": "brightYellow",
    "ANSIBrightBlueColor": "brightBlue",
    "ANSIBrightMagentaColor": "brightMagenta",
    "ANSIBrightCyanColor": "brightCyan",
    "ANSIBrightWhiteColor": "brightWhite",
}

result = {}
for plist_key, name in keys_map.items():
    if plist_key in profile and isinstance(profile[plist_key], bytes):
        color = decode_nscolor(profile[plist_key])
        if color:
            result[name] = color

# Default black if not decoded (NSWhite 0)
if "black" not in result:
    result["black"] = "#000000"

print(json.dumps(result))
