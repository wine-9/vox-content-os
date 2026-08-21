#!/usr/bin/env python3
import argparse,sqlite3,shutil,os,subprocess,hashlib,urllib.request,urllib.parse,re,json,html,time,uuid,mimetypes
P=argparse.ArgumentParser();P.add_argument('--staging-id',required=True);P.add_argument('--cover',required=True);P.add_argument('--title',required=True);P.add_argument('--source-url',default='');a=P.parse_args()
# Chrome cookies -> memory only
src=os.path.expanduser('~/Library/Application Support/Google/Chrome/Default/Cookies');tmp=f'/tmp/vox-wx-cookie-{os.getpid()}.sqlite';shutil.copy2(src,tmp)
pw=subprocess.check_output(['security','find-generic-password','-s','Chrome Safe Storage','-w'],text=True,stderr=subprocess.DEVNULL).strip();key=hashlib.pbkdf2_hmac('sha1',pw.encode(),b'saltysalt',1003,16);iv=b' '*16;c=sqlite3.connect(tmp);vals={}
for host,name,enc,plain in c.execute("select host_key,name,encrypted_value,value from cookies where host_key='mp.weixin.qq.com'"):
 val=plain or ''
 if not val and enc:
  b=bytes(enc);ct=b[3:] if b.startswith(b'v10') else b;p=subprocess.check_output(['openssl','enc','-d','-aes-128-cbc','-K',key.hex(),'-iv',iv.hex(),'-nopad'],input=ct,stderr=subprocess.DEVNULL);pad=p[-1];p=p[:-pad] if 1<=pad<=16 and p.endswith(bytes([pad])*pad) else p;hh=hashlib.sha256(host.encode()).digest();p=p[32:] if p.startswith(hh) else p
  try:val=p.decode()
  except:val=''
 if val:vals[name]=val
c.close();os.unlink(tmp);cookie='; '.join(f'{k}={v}' for k,v in vals.items());UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36';H={'Cookie':cookie,'User-Agent':UA}
def get(u):return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=25).read().decode('utf8','ignore')
root=get('https://mp.weixin.qq.com/');grab=lambda pat:(re.search(pat,root,re.S) or [None,None])[1]
token=grab(r'data:\s*\{[\s\S]*?t:\s*["\']([^"\']+)');user=grab(r'user_name:\s*["\']([^"\']+)');ticket=grab(r'ticket:\s*["\']([^"\']+)');svr=grab(r'time:\s*["\'](\d+)')
if not all([token,user,ticket,svr]):raise SystemExit('WECHAT_SESSION_META_MISSING')
# staging content
ed=get(f'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid={a.staging_id}&token={token}&lang=zh_CN');pos=ed.find('infos =');brace=ed.find('{',pos);info,_=json.JSONDecoder().raw_decode(ed[brace:]);item=(info.get('item')or[])[0];content=html.unescape(item.get('content')or'')
if not content or 'mmbiz' not in content:raise SystemExit('STAGING_CONTENT_NOT_READY')
# multipart cover upload
boundary='----VOX'+uuid.uuid4().hex;cover=os.path.abspath(a.cover);data=open(cover,'rb').read();mime=mimetypes.guess_type(cover)[0]or'image/png';ts=str(int(time.time()*1000));parts=[]
def field(k,v):parts.extend([f'--{boundary}\r\n'.encode(),f'Content-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()])
for k,v in [('type',mime),('id',ts),('name',os.path.basename(cover)),('lastModifiedDate',time.ctime()),('size',str(len(data)))]:field(k,v)
parts.extend([f'--{boundary}\r\n'.encode(),f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(cover)}"\r\nContent-Type: {mime}\r\n\r\n'.encode(),data,b'\r\n',f'--{boundary}--\r\n'.encode()]);body=b''.join(parts)
u=f'https://mp.weixin.qq.com/cgi-bin/filetransfer?action=upload_material&f=json&scene=8&writetype=doublewrite&groupid=1&ticket_id={urllib.parse.quote(user)}&ticket={urllib.parse.quote(ticket)}&svr_time={svr}&token={token}&lang=zh_CN&seq={ts}&t=0.5';req=urllib.request.Request(u,data=body,headers={**H,'Origin':'https://mp.weixin.qq.com','Referer':'https://mp.weixin.qq.com/','Content-Type':f'multipart/form-data; boundary={boundary}'},method='POST');up=json.loads(urllib.request.urlopen(req,timeout=40).read());covercdn=up.get('cdn_url')or''
if not covercdn:raise SystemExit('WECHAT_COVER_UPLOAD_FAILED')
# Match the current WeChat editor's cropImgCgi.getUrlMulti() flow.
# The confirmed cover is never regenerated; WeChat only creates platform-native crops.
dim=subprocess.check_output(['/usr/bin/sips','-g','pixelWidth','-g','pixelHeight',cover],text=True,stderr=subprocess.DEVNULL)
mw=re.search(r'pixelWidth:\s*(\d+)',dim);mh=re.search(r'pixelHeight:\s*(\d+)',dim)
if not mw or not mh:raise SystemExit('COVER_DIMENSION_READ_FAILED')
W,Hh=int(mw.group(1)),int(mh.group(1))
def center_crop(r):
 ar=W/Hh
 if ar>r:
  x1=(1-r/ar)/2;return (x1,0,1-x1,1)
 if ar<r:
  y1=(1-ar/r)/2;return (0,y1,1,1-y1)
 return (0,0,1,1)
ratios=[('2.35_1',2.35),('16_9',16/9),('1_1',1.0)]
crop_data={'imgurl':covercdn,'size_count':str(len(ratios))}
coords={}
for i,(name,r) in enumerate(ratios):
 x1,y1,x2,y2=center_crop(r);coords[name]=(x1,y1,x2,y2)
 crop_data.update({f'size{i}_x1':str(x1),f'size{i}_y1':str(y1),f'size{i}_x2':str(x2),f'size{i}_y2':str(y2),f'format{i}':name})
creq=urllib.request.Request(f'https://mp.weixin.qq.com/cgi-bin/cropimage?action=crop_multi&token={token}&lang=zh_CN',data=urllib.parse.urlencode(crop_data).encode(),headers={**H,'Origin':'https://mp.weixin.qq.com','Referer':'https://mp.weixin.qq.com/','Content-Type':'application/x-www-form-urlencoded'},method='POST')
crop=json.loads(urllib.request.urlopen(creq,timeout=30).read())
results=crop.get('result')or[]
if (crop.get('base_resp')or{}).get('ret')!=0 or len(results)!=len(ratios):raise SystemExit('WECHAT_COVER_CROP_FAILED')
variants={name:{'url':results[i].get('cdnurl')or'','file_id':str(results[i].get('file_id')or''),'width':results[i].get('width')or 0,'height':results[i].get('height')or 0,'coords':coords[name]} for i,(name,_) in enumerate(ratios)}
if any(not v['url'] or not v['file_id'] for v in variants.values()):raise SystemExit('WECHAT_COVER_CROP_RESULT_INCOMPLETE')
def crop_item(name,v):
 x1,y1,x2,y2=v['coords'];return {'ratio':name,'x1':int(round(x1*W)),'y1':int(round(y1*Hh)),'x2':int(round(x2*W)),'y2':int(round(y2*Hh)),'file_id':v['file_id']}
def crop_pct(name,v):
 x1,y1,x2,y2=v['coords'];return {'ratio':name,'x1':x1,'y1':y1,'x2':x2,'y2':y2,'file_id':v['file_id']}
crop_list=json.dumps({'crop_list':[crop_item(k,v) for k,v in variants.items()],'crop_list_percent':[crop_pct(k,v) for k,v in variants.items()]},ensure_ascii=False,separators=(',',':'))
primary=variants['2.35_1'];v169=variants['16_9'];v11=variants['1_1']
form={'token':token,'lang':'zh_CN','f':'json','ajax':'1','random':'0.52','AppMsgId':'','count':'1','data_seq':'0','operate_from':'Chrome','isnew':'0','ad_video_transition0':'','can_reward0':'0','related_video0':'','is_video_recommend0':'-1','title0':a.title,'author0':'','writerid0':'0','fileid0':primary['file_id'],'digest0':'','auto_gen_digest0':'1','content0':content,'sourceurl0':a.source_url,'need_open_comment0':'1','only_fans_can_comment0':'0','cdn_url0':primary['url'],'cdn_235_1_url0':primary['url'],'cdn_16_9_url0':v169['url'],'cdn_1_1_url0':v11['url'],'cdn_url_back0':covercdn,'crop_list0':crop_list,'music_id0':'','video_id0':'','voteid0':'','voteismlt0':'','supervoteid0':'','cardid0':'','cardquantity0':'','cardlimit0':'','vid_type0':'','show_cover_pic0':'0','shortvideofileid0':'','copyright_type0':'0','releasefirst0':'','platform0':'','reprint_permit_type0':'','allow_reprint0':'','allow_reprint_modify0':'','original_article_type0':'','ori_white_list0':'','free_content0':'','fee0':'0','ad_id0':'','guide_words0':'','is_share_copyright0':'0','share_copyright_url0':'','source_article_type0':'','reprint_recommend_title0':'','reprint_recommend_content0':'','share_page_type0':'0','share_imageinfo0':'{"list":[]}','share_video_id0':'','dot0':'{}','share_voice_id0':'','insert_ad_mode0':'','categories_list0':'[]'}
req=urllib.request.Request(f'https://mp.weixin.qq.com/cgi-bin/operate_appmsg?t=ajax-response&sub=create&type=77&token={token}&lang=zh_CN',data=urllib.parse.urlencode(form).encode(),headers={**H,'Origin':'https://mp.weixin.qq.com','Referer':'https://mp.weixin.qq.com/','Content-Type':'application/x-www-form-urlencoded'},method='POST');res=json.loads(urllib.request.urlopen(req,timeout=35).read());newid=str(res.get('appMsgId')or'')
if not newid:raise SystemExit('WECHAT_FINAL_DRAFT_CREATE_FAILED')
ve=get(f'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid={newid}&token={token}&lang=zh_CN');pos=ve.find('infos =');brace=ve.find('{',pos);ii,_=json.JSONDecoder().raw_decode(ve[brace:]);it=(ii.get('item')or[])[0];raw=json.dumps(it,ensure_ascii=False)
mi0=((it.get('multi_item')or[{}])[0] if isinstance(it.get('multi_item'),list) else {}) or {}
cover_saved=bool(mi0.get('cover') or mi0.get('cdn_url') or mi0.get('cdn_235_1_url') or mi0.get('cdn_1_1_url') or it.get('file_id'))
source_saved=(a.source_url in raw) if a.source_url else True
body_html=html.unescape(it.get('content')or'')
print(json.dumps({'ok':bool(cover_saved and source_saved),'appMsgId':newid,'coverSaved':bool(cover_saved),'sourceUrlSaved':bool(source_saved),'contentImageTags':len(re.findall(r'<img\b',body_html,re.I)),'coverVariants':len(variants)},ensure_ascii=False))
if not cover_saved:raise SystemExit('WECHAT_FINAL_COVER_VERIFY_FAILED')
if not source_saved:raise SystemExit('WECHAT_FINAL_SOURCEURL_VERIFY_FAILED')
