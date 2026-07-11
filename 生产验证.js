// 生产 MVP 安全与预约闭环验证（运行于临时副本，不污染仓库 data.json）
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gaoligong-mvp-'));
const PORT = 8091;
const ADMIN = 'test-admin-token';
let USER_TOKEN = '';
for (const file of ['服务器.js', '用户前台.html', '管理后台.html']) fs.copyFileSync(path.join(ROOT, file), path.join(TMP, file));

const proc = spawn(process.execPath, ['服务器.js'], { cwd: TMP, env: { ...process.env, PORT: String(PORT), ADMIN_TOKEN: ADMIN }, stdio: ['ignore', 'pipe', 'pipe'] });
const BASE = `http://127.0.0.1:${PORT}`;
const pass = [], fail = [];
const chk = (condition, name, extra = '') => (condition ? pass : fail).push(`${condition ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stop = () => new Promise(resolve => { if (proc.exitCode !== null) return resolve(); proc.once('exit', resolve); proc.kill(); });
async function api(route, method = 'GET', body) {
  const options = { method, headers: USER_TOKEN ? { authorization: `Bearer ${USER_TOKEN}` } : {} };
  if (body !== undefined) { options.headers['content-type'] = 'application/json'; options.body = JSON.stringify(body); }
  const response = await fetch(BASE + route, options);
  let data = null; try { data = await response.json(); } catch (_) {}
  return { status: response.status, data };
}
function makeId(area, birth, seq) {
  const b = area + birth + seq;
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const c = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0; for (let i = 0; i < 17; i++) sum += Number(b[i]) * w[i];
  return b + c[sum % 11];
}

(async () => {
  await sleep(250);
  let r = await api('/healthz');
  chk(r.status === 200 && r.data && r.data.ok, '服务启动');
  r = await api('/api/register', 'POST', { phone: '13800001001', pwd: 'plain-secret', name: '安全测试用户', id: makeId('530102', '19900515', '001') });
  const uid = r.data && r.data.uid; USER_TOKEN = r.data && r.data.token;
  chk(r.status === 200 && uid, '注册成功');
  const raw = JSON.parse(fs.readFileSync(path.join(TMP, 'data.json'), 'utf8'));
  chk(raw.users[0] && raw.users[0].pwd !== 'plain-secret', '密码不以明文落盘');
  r = await api('/api/login', 'POST', { phone: '13800001001', pwd: 'wrong' });
  chk(r.status === 401, '错误密码被拒');
  r = await api('/api/admin/data?token=wrong');
  chk(r.status === 403, '错误管理 token 被拒');
  r = await api('/api/admin/data?token=' + ADMIN);
  chk(r.status === 200, '环境变量管理 token 生效');
  USER_TOKEN = '';
  r = await api('/api/me/' + uid);
  chk(r.status === 401, '未带用户会话访问个人数据被拒');
  USER_TOKEN = JSON.parse(fs.readFileSync(path.join(TMP, 'data.json'), 'utf8')).users[0] ? USER_TOKEN : USER_TOKEN;
  // 注册响应中的 token 已保存；恢复它后再走预约链路
  USER_TOKEN = (await api('/api/login', 'POST', { phone: '13800001001', pwd: 'plain-secret' })).data.token;
  r = await api('/api/booking', 'POST', { uid, actId: 'act_yx', date: '7/18 上午', participants: [{ name: '孩子甲', id: makeId('530102', '20150101', '002'), guardian: true }] });
  chk(r.status === 200 && r.data && r.data.booking, '预约主链路可用');
  const createdBooking = r.data && r.data.booking;
  r = await api('/api/notifications/' + uid);
  chk(r.status === 200 && r.data.notifications.some(n => /预约/.test(n.message)), '站内预约通知已生成');
  const code = createdBooking && createdBooking.code;
  chk(createdBooking && createdBooking.participants.length === 1 && createdBooking.credentialPayload === `booking:${code}`, '家庭成员与凭证 payload 已保存');
  r = await api('/api/booking', 'POST', { uid, actId: 'act_yx', date: '7/18 上午', participants: [{ name: '孩子乙' }] });
  chk(r.status === 400, '同一用户重复预约被拒');
  const bookingId = JSON.parse(fs.readFileSync(path.join(TMP, 'data.json'), 'utf8')).bookings[0].id;
  r = await api('/api/booking/cancel', 'POST', { uid, bookingId });
  chk(r.status === 200, '取消预约接口可用');
  r = await api('/api/admin/verify', 'POST', { token: ADMIN, code });
  chk(r.status === 400, '已取消凭证不可核销');
  await stop();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(pass.join('\n'));
  console.log(fail.join('\n'));
  console.log(`验证结果：通过 ${pass.length} / 失败 ${fail.length}`);
  process.exit(fail.length ? 1 : 0);
})().catch(async error => { try { await stop(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} console.error(error); process.exit(2); });

