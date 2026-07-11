// 端到端验证测试 - 哇噻·高黎贡·自然纪 预约小程序后端
const BASE = process.env.TEST_BASE || 'http://localhost:8090';
const TOKEN = process.env.TEST_ADMIN_TOKEN || 'admin888';
let AUTH_TOKEN = '';
const log = (ok, name, extra='') => console.log(`${ok?'✅':'❌'} ${name} ${extra}`);
let pass=0, fail=0;
function chk(cond,name,extra=''){ if(cond){pass++;log(true,name,extra);} else {fail++;log(false,name,extra);} }

// 生成合法身份证号（带校验位）
function makeId(area,birth,seq){
  const b=area+birth+seq;
  const w=[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2];
  const c=['1','0','X','9','8','7','6','5','4','3','2'];
  let s=0; for(let i=0;i<17;i++) s+=(+b[i])*w[i];
  return b+c[s%11];
}
const ID_ADULT  = makeId('530102','19900515','001'); // 1990年生 男 成年
const ID_MINOR  = makeId('530102','20150101','002'); // 2015年生 未成年
const ID_ELDER  = makeId('530102','19490101','003'); // 1949年生 高龄
const ID_GUARD  = makeId('530102','19800101','004'); // 监护人 1980年生
const ID_MINOR2 = makeId('530102','20160101','005'); // 另一未成年(带监护人)

async function api(path, method='GET', body=null){
  const opt={method, headers:AUTH_TOKEN?{Authorization:'Bearer '+AUTH_TOKEN}:{}};
  if(body){ opt.headers['Content-Type']='application/json'; opt.body=JSON.stringify(body); }
  const r = await fetch(BASE+path, opt);
  let data=null; try{ data=await r.json(); }catch(e){}
  return {status:r.status, data};
}

(async()=>{
  console.log('===== 哇噻·高黎贡 预约小程序 · 端到端验证 =====\n');

  // 0. ping
  let r = await api('/api/ping');
  chk(r.status===200 && r.data?.ok, '0. 服务存活 ping', JSON.stringify(r.data));

  // 1. 注册-成年
  r = await api('/api/register','POST',{phone:'13800000001',pwd:'abc123',name:'成年用户',id:ID_ADULT});
  const adultUid = r.data?.uid;
  AUTH_TOKEN = r.data?.token;
  chk(r.status===200 && adultUid, '1. 成年注册成功', 'uid='+(adultUid||'null'));
  chk(r.data?.user?.age>=18 && r.data?.user?.age<70, '   自动年龄/身份=成人', 'age='+(r.data?.user?.age));

  // 2. 注册-未成年无监护人 → 应拦截
  r = await api('/api/register','POST',{phone:'13900000002',pwd:'pw2',name:'未成年无监护',id:ID_MINOR});
  chk(r.status===400 && /监护人/.test(r.data?.error||''), '2. 未成年无监护人被拦截', r.data?.error||'');

  // 3. 注册-未成年带监护人 → 成功
  r = await api('/api/register','POST',{phone:'13900000003',pwd:'pw3',name:'未成年有监护',id:ID_MINOR2,guardianName:'监护人甲',guardianId:ID_GUARD,guardianPhone:'13700000003'});
  const minorUid = r.data?.uid;
  const minorToken = r.data?.token;
  chk(r.status===200 && minorUid, '3. 未成年带监护人注册成功', 'uid='+(minorUid||'null'));
  chk(r.data?.user?.age<18 && r.data?.user?.guardian?.name, '   未成年且监护人已绑定', 'age='+(r.data?.user?.age)+' guardian='+(r.data?.user?.guardian?.name||'null'));

  // 4. 注册-高龄无监护人 → 应拦截
  r = await api('/api/register','POST',{phone:'13600000004',pwd:'pw4',name:'高龄无监护',id:ID_ELDER});
  chk(r.status===400 && /监护人/.test(r.data?.error||''), '4. 高龄(≥70)无监护人被拦截', r.data?.error||'');

  // 5. 重复注册同手机号 → 应拦截
  r = await api('/api/register','POST',{phone:'13800000001',pwd:'abc123',name:'重复',id:ID_ADULT});
  chk(r.status===400, '5. 重复手机号注册被拦截', r.data?.error||'');

  // 6. 登录-错误密码
  r = await api('/api/login','POST',{phone:'13800000001',pwd:'wrong'});
  chk(r.status===401, '6. 错误密码登录被拒', r.data?.error||'');

  // 7. 登录-正确密码
  r = await api('/api/login','POST',{phone:'13800000001',pwd:'abc123'});
  AUTH_TOKEN = r.data?.token;
  chk(r.status===200 && r.data?.uid===adultUid, '7. 正确密码登录成功', 'uid='+(r.data?.uid));

  // 8. 后台实时可见 - admin/data
  r = await api(`/api/admin/data?token=${TOKEN}`);
  chk(r.status===200 && r.data?.stats?.totalUsers>=2, '8. 后台实时看到注册用户', 'totalUsers='+(r.data?.stats?.totalUsers));
  const hasMinor = r.data?.users?.some(u=>u.guardian && u.guardian.name);
  chk(hasMinor, '   后台可见监护人标记', '含未成年/高龄绑定监护人='+hasMinor);

  // 9. 预约-研学
  r = await api('/api/booking','POST',{uid:adultUid,actId:'act_yx',actTitle:'周末研学活动',type:'yanxue',date:'7/18 上午',session:'场1'});
  const bkCode = r.data?.booking?.code;
  chk(r.status===200 && /^YX-/.test(bkCode||''), '9. 研学预约成功生成凭证码', 'code='+(bkCode||'null'));
  const bkStatus = r.data?.booking?.status;
  chk(bkStatus==='pending', '   初始状态=待核销', 'status='+bkStatus);

  // 10. 预约-免票日
  AUTH_TOKEN = minorToken;
  r = await api('/api/booking','POST',{uid:minorUid,actId:'act_mp',actTitle:'免票活动日',type:'mianpiao',date:'7/20 全天'});
  const bkCode2 = r.data?.booking?.code;
  chk(r.status===200 && /^MP-/.test(bkCode2||''), '10. 免票日预约成功', 'code='+(bkCode2||'null'));

  // 11. 核销-正确码
  r = await api('/api/admin/verify','POST',{token:TOKEN, code:bkCode});
  chk(r.status===200 && r.data?.ok, '11. 凭证码核销成功', r.data?.booking?.status||'');
  chk(r.data?.booking?.status==='verified', '   核销后状态=已核销', r.data?.booking?.status);

  // 12. 核销-重复码 → 应拦截
  r = await api('/api/admin/verify','POST',{token:TOKEN, code:bkCode});
  chk(r.status===400, '12. 重复核销被拦截', r.data?.error||'');

  // 13. 核销-错误码 → 应拦截
  r = await api('/api/admin/verify','POST',{token:TOKEN, code:'YX-ZZZZZ'});
  chk(r.status===404, '13. 无效凭证码被拦截', r.data?.error||'');

  // 14. 选举投票
  AUTH_TOKEN = (await api('/api/login','POST',{phone:'13800000001',pwd:'abc123'})).data?.token;
  r = await api('/api/vote','POST',{uid:adultUid, actId:'act_dean', candId:'c1'});
  chk(r.status===200 && r.data?.ok, '14. 名誉院长选举投票成功', '票数='+(r.data?.votes?.find(v=>v.candId==='c1')?.count));

  // 15. 选举重复投票 → 应拦截
  r = await api('/api/vote','POST',{uid:adultUid, actId:'act_dean', candId:'c2'});
  chk(r.status===400, '15. 重复投票被拦截', r.data?.error||'');

  // 16. 大赛投稿
  r = await api('/api/contest','POST',{uid:adultUid, actId:'act_contest', title:'我的自然记录', desc:'一只蝴蝶', mediaType:'photo', mediaUrl:'data:image/xyz'});
  const workId = r.data?.work?.id;
  chk(r.status===200 && workId, '16. 自然记录大赛投稿成功', 'workId='+(workId||'null'));

  // 17. 活动下架 → 前台列表应不再包含该活动
  r = await api('/api/admin/activity','POST',{token:TOKEN, action:'toggle', id:'act_mp'});
  chk(r.status===200, '17. 活动下架(切换状态)成功', r.data?.activity?.status||'');
  // 前台活动列表应不含 act_mp（/api/activities 只返回 online）
  r = await api('/api/activities');
  const mpOffline = r.data?.activities?.find(a=>a.id==='act_mp');
  chk(!mpOffline, '   下架后前台列表已隐藏该活动', mpOffline?'仍可见(异常)':'已隐藏(正确)');

  // 18. 活动重新上架
  r = await api('/api/admin/activity','POST',{token:TOKEN, action:'toggle', id:'act_mp'});
  chk(r.status===200 && r.data?.activity?.status==='online', '18. 活动重新上架', r.data?.activity?.status);

  // 19. 标记大赛优胜（正确端点 /api/admin/winner，参数 workId）
  r = await api('/api/admin/winner','POST',{token:TOKEN, workId});
  chk(r.status===200 && r.data?.work?.isWinner===true, '19. 标记大赛优胜成功', 'isWinner='+(r.data?.work?.isWinner));

  // 20. 导出 CSV - bookings
  r = await fetch(`${BASE}/api/export/bookings?token=${TOKEN}`);
  const csv = await r.text();
  chk(r.status===200 && csv.includes('凭证码') && csv.includes(bkCode), '20. 导出预约CSV含数据', 'bytes='+csv.length);

  // 21. 导出 CSV - users
  r = await fetch(`${BASE}/api/export/users?token=${TOKEN}`);
  const csvU = await r.text();
  chk(r.status===200 && csvU.includes('手机号'), '21. 导出用户CSV', 'bytes='+csvU.length);

  // 22. 导出 CSV - 错误token
  r = await fetch(`${BASE}/api/export/bookings?token=wrong`);
  chk(r.status===403, '22. 错误token导出被拦截', 'status='+r.status);

  // 23. 后台错误token → 拦截
  r = await api('/api/admin/data?token=wrong');
  chk(r.status===403, '23. 后台错误token被拦截', 'status='+r.status);

  // 24. SSE 实时推送 - 订阅后产生新预约应收到事件
  const es = await fetch(`${BASE}/api/stream?token=${TOKEN}`);
  let gotEvent=false; const start=Date.now();
  const reader = es.body.getReader(); const dec=new TextDecoder();
  let buf='';
  // 触发一个事件：新预约
  const p = api('/api/booking','POST',{uid:adultUid,actId:'act_yx',actTitle:'周末研学活动',type:'yanxue',date:'7/19 上午',session:'场2'});
  while(Date.now()-start < 4000){
    const {done,value}=await reader.read();
    if(done) break;
    buf+=dec.decode(value);
    if(buf.includes('"type"') && (buf.includes('booking')||buf.includes('ping'))){ gotEvent=true; break; }
  }
  await p;
  chk(gotEvent, '24. SSE实时推送收到事件', '收到推送='+gotEvent);

  console.log(`\n===== 验证结果：通过 ${pass} / 失败 ${fail} =====`);
  process.exit(fail>0?1:0);
})().catch(e=>{ console.error('测试异常:', e); process.exit(2); });

