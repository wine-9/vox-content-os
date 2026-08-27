#!/bin/zsh
set -u

unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

exec /opt/homebrew/bin/cloudflared \
  --config /Users/voxrockschool/.cloudflared/sinote-content-os.yml \
  tunnel --no-autoupdate run
