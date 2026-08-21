#!/bin/zsh
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then npm install; fi
if [ ! -d .next ]; then npm run build; fi
./scripts/start-omniseek.command >/dev/null 2>&1 || true
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  open http://localhost:3000
  exit 0
fi
nohup npm run start -- -H 0.0.0.0 > .vox-content-os.log 2>&1 &
echo $! > .vox-content-os.pid
sleep 1
open http://localhost:3000
