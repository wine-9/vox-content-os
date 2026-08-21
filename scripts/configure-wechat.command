#!/bin/zsh
set -e
cd "$(dirname "$0")/.."
clear
echo "VOX Content OS · 微信公众号官方 API 配置"
echo
echo "凭据只写入本机 .env.local，不会打印 AppSecret。"
printf "公众号 AppID: "
read APPID
printf "公众号 AppSecret（输入时隐藏）: "
read -s APPSECRET
echo
if [[ -z "$APPID" || -z "$APPSECRET" ]]; then echo "AppID / AppSecret 不能为空。"; exit 1; fi
APPID="$APPID" APPSECRET="$APPSECRET" python3 <<'PY'
import os
from pathlib import Path
p=Path('.env.local')
text=p.read_text() if p.exists() else ''
vals={'WECHAT_APP_ID':os.environ['APPID'].strip(),'WECHAT_APP_SECRET':os.environ['APPSECRET'].strip()}
lines=text.splitlines(); seen=set(); out=[]
for line in lines:
    key=line.split('=',1)[0].strip() if '=' in line else ''
    if key in vals:
        out.append(f'{key}={vals[key]}'); seen.add(key)
    else: out.append(line)
for k,v in vals.items():
    if k not in seen: out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PY
echo "已写入 .env.local。"
echo "正在重启 VOX Content OS…"
old=$(cat .vox-content-os.pid 2>/dev/null || true)
if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then kill "$old" || true; sleep 1; fi
nohup npm run start -- -H 0.0.0.0 > .vox-content-os.log 2>&1 & echo $! > .vox-content-os.pid
for i in {1..40}; do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then echo "服务已重启。回到发布控制台，点击『三端预检』。"; exit 0; fi
  sleep .5
done
echo "服务重启未及时响应，请检查 .vox-content-os.log。"
exit 1
