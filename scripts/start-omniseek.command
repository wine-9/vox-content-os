#!/bin/zsh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OMNI="$ROOT/vendor/omniseek"
if curl -fsS --max-time 2 http://127.0.0.1:8765/healthz >/dev/null 2>&1; then exit 0; fi
PY="${OMNISEEK_PYTHON:-/Users/voxrockschool/Projects/_skill_installs/omniseek-venv/bin/python}"
if [ ! -x "$PY" ]; then echo "OmniSeek venv missing" >&2; exit 1; fi
cd "$OMNI"
HOME="$OMNI/.runtime-home" nohup "$PY" -m omniseek.serve_http > omniseek.log 2>&1 &
echo $! > omniseek.pid
for i in {1..10}; do
  sleep 1
  curl -fsS --max-time 2 http://127.0.0.1:8765/healthz >/dev/null 2>&1 && exit 0
done
echo "OmniSeek failed health check" >&2
exit 1
