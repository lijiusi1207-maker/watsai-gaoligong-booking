const BASE=process.env.TEST_BASE || 'http://localhost:8090';
const TOKEN=process.env.TEST_ADMIN_TOKEN || 'admin888';
let AUTH_TOKEN='';
function id17(seq){const b='530102'+'19900515'+seq;const w=[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2],c=['1','0','X','9','8','7','6','5','4','3','2'];let s=0;for(let i=0;i<17;i++)s+=(+b[i])*w[i];return b+c[s%11];}
async function api(path,body){const opt={headers:{'Content-Type':'application/json'}};if(AUTH_TOKEN)opt.headers.Authorization='Bearer '+AUTH_TOKEN;if(body){opt.method='POST';opt.body=JSON.stringify(body);}const r=await fetch(BASE+path,opt);return await r.json();}
const pass=[],fail=[];
function chk(c,m,extra){ (c?pass:fail).push(m+(extra?' ('+extra+')':'')); }
let code=0;
try{
  // 1. rich activity create
  const created=await api('/api/admin/activity',{token:TOKEN,action:'create',type:'yanxue',title:'亲子自然课堂',emoji:'🌿',desc:'家长与孩子共同完成',location:'园区亲子教室',capacity:'20组家庭/场',deadline:'活动前2天',rules:'须监护人陪同',tags:'亲子,家庭',config:{sessions:['周六 上午','周日 上午']}});
  chk(created.ok,'1. 富字段活动创建成功','id='+(created.activity&&created.activity.id));
  // 2. appears in public list with rich fields
  const acts=await api('/api/activities');
  const a=acts.activities.find(x=>x.title==='亲子自然课堂');
  chk(!!a && a.location==='园区亲子教室' && a.capacity==='20组家庭/场' && a.rules==='须监护人陪同' && a.tags==='亲子,家庭' && JSON.stringify(a.config.sessions)===JSON.stringify(['周六 上午','周日 上午']),'2. 公开列表含富字段(地点/名额/规则/标签/场次)');
  // 3. register
  const ID=id17('001');
  const reg=await api('/api/register',{phone:'13700000999',pwd:'pw1',name:'投稿人',id:ID});
  chk(reg.ok && reg.uid,'3. 注册成功','uid='+(reg.uid||'null'));
  const uid=reg.uid;
  AUTH_TOKEN=reg.token;
  // 4. contest submit
  const ct=await api('/api/contest',{uid,title:'我的自然照',desc:'好看',mediaType:'photo',mediaUrl:'data:image/png;base64,xx'});
  chk(ct.ok && ct.work && ct.work.id,'4. 大赛投稿成功','workId='+(ct.work&&ct.work.id));
  const wid=ct.work.id;
  // 5. mark winner
  const w1=await api('/api/admin/winner',{token:TOKEN,workId:wid});
  chk(w1.ok && w1.work.isWinner===true,'5. 标记优胜 → isWinner=true');
  // 6. unmark
  const w2=await api('/api/admin/winner',{token:TOKEN,workId:wid});
  chk(w2.ok && w2.work.isWinner===false,'6. 取消优胜 → isWinner=false');
  // 7. admin data sees contest with isWinner=false
  const ad=await api('/api/admin/data?token='+TOKEN);
  const cw=ad.contests.find(c=>c.id===wid);
  chk(cw && cw.isWinner===false,'7. 后台数据含该作品且 isWinner=false');
}catch(e){ fail.push('EXCEPTION: '+e.message); code=1; }
console.log('PASS('+pass.length+'):'); pass.forEach(p=>console.log('  ✓ '+p));
console.log('FAIL('+fail.length+'):'); fail.forEach(f=>console.log('  ✗ '+f));
process.exitCode=code||(fail.length?1:0);

