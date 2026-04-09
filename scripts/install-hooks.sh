#!/bin/sh
# Install git hooks for local development

HOOK_DIR="$(git rev-parse --show-toplevel)/.git/hooks"

cat > "$HOOK_DIR/pre-push" << 'HOOK'
#!/bin/sh
echo "Running pre-push checks..."
bun run check
HOOK

chmod +x "$HOOK_DIR/pre-push"
echo "Installed pre-push hook."
