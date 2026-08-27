#!/bin/zsh
set -u

PROJECT_DIR="/Users/voxrockschool/Projects/VOX-Content-OS/vox-content-os-mvp"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$PROJECT_DIR"

if ! /usr/sbin/lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  exec /opt/homebrew/bin/npm run start -- -H 0.0.0.0
fi

# A manually started instance is already serving the port. Keep this
# LaunchAgent alive without starting a second Next.js process.
while /usr/sbin/lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; do
  /bin/sleep 15
done

exec /opt/homebrew/bin/npm run start -- -H 0.0.0.0
