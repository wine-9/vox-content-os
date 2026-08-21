#!/bin/zsh
cd "$(dirname "$0")"
if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "VOX Content OS: RUNNING"
  curl -fsS http://127.0.0.1:3000/api/health
  echo
else
  echo "VOX Content OS: STOPPED"
fi
