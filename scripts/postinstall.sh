#!/bin/sh
# Fix node-pty spawn-helper permissions.
# Bun (and some npm versions) strip the execute bit from prebuilt binaries
# during installation. Without +x, node-pty's posix_spawnp call fails silently.

SPAWN_HELPERS=$(find node_modules/node-pty/prebuilds -name spawn-helper 2>/dev/null)
for helper in $SPAWN_HELPERS; do
  chmod +x "$helper" 2>/dev/null
done

# Also check build/Release if it exists (npm rebuild)
if [ -f node_modules/node-pty/build/Release/spawn-helper ]; then
  chmod +x node_modules/node-pty/build/Release/spawn-helper 2>/dev/null
fi
