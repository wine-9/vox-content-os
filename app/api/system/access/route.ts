import os from 'node:os';
import {execFileSync} from 'node:child_process';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function isPrivate(ip:string){return /^10\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip)}
function lanIp(){for(const list of Object.values(os.networkInterfaces()))for(const x of list||[])if(x.family==='IPv4'&&!x.internal&&isPrivate(x.address))return x.address;return null}
function tailscale(){try{const raw=execFileSync('/usr/local/bin/tailscale',['status','--json'],{encoding:'utf8',timeout:3500,stdio:['ignore','pipe','ignore']});const x=JSON.parse(raw),ip=(x.TailscaleIPs||[]).find((v:string)=>/^100\./.test(v))||null,dns=String(x?.Self?.DNSName||'').replace(/\.$/,'')||null,running=x.BackendState==='Running'&&!!x?.Self?.Online;return{installed:true,running,ip,dnsName:dns,url:running&&ip?`http://${ip}:3000`:null,dnsUrl:running&&dns?`http://${dns}:3000`:null}}catch{return{installed:false,running:false,ip:null,dnsName:null,url:null,dnsUrl:null}}}
export async function GET(){const ip=lanIp(),ts=tailscale();return Response.json({ok:true,port:3000,lan:{ip,url:ip?`http://${ip}:3000`:null},tailscale:ts,updatedAt:new Date().toISOString()},{headers:{'cache-control':'no-store'}})}
