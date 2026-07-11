/**
 * 哇噻·高黎贡·自然纪 — 预约小程序后端服务（纯 Node，零依赖）
 * 功能：
 *  - 静态托管 用户前台.html（前台）/ 管理后台.html（后台）
 *  - JSON 文件持久化（data.json）
 *  - REST API：注册/登录/活动/预约/投票/大赛/我的
 *  - 后台：数据总览 / 核销 / 活动上下架 / 优胜 / 导出
 *  - SSE 实时推送：用户注册/预约/投票/核销 → 后台即时可见
 *
 * 运行：node 服务器.js   （可选 PORT=8090）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin888';
const PORT = process.env.PORT || 8090;
const MINOR_AGE = 18;
const ELDER_AGE = 70;

// ---------- 数据层 ----------
function defaultDB() {
  const now = Date.now();
  return {
    users: [],
    bookings: [],
    activities: [
      { id: 'act_yx', type: 'yanxue', title: '周末研学·7/18–19 亲子自然课', emoji: '🎒', status: 'online',
        desc: '收票赠课：购门票入园即赠「价值80元·暂定价」园区内自然课（实际免费）。7/18–7/19 四场，不出园、安全亲近高黎贡。',
        location: '园区内 · 专属研学动线区 / 研学教室（与走客动线≥50m 隔离）',
        capacity: '场1 ≤15（3–6岁）｜场2/3/4 ≤30（7–12岁）',
        deadline: '报名截止 2026-07-17 24:00',
        rules: '①收票赠课，购票即赠，不再另收研学费；②到园「门票+预约码」双码核销；③报名收9.9元可退押金（信用良好免押）；④3–6岁须家长全程陪同；⑤雨天切换室内单课（雨备馆≤100人）。',
        tags: '研学,亲子,周末,收票赠课',
        config: {
          price: '赠课免费（对外价值锚定 ¥80·暂定价）',
          sessions: [
            '7/18 上午 09:30–11:30｜主题四·微缩生态×园区实景对照（3–6岁·做生态瓶带走）',
            '7/18 下午 14:30–16:30｜主题二·活体标本+声纹/痕迹任务（7–12岁·出片+录制）',
            '7/19 上午 09:30–11:30｜主题一·一园看四季·带谱可视化走廊（7–12岁·视觉震撼）',
            '7/19 下午 14:30–16:30｜主题三·生物多样性监测·公民科学家（7–12岁·样线+集章）'
          ],
          sessionDetail: [
            { time: '7/18 上午', theme: '微缩生态×园区实景对照', age: '3–6岁', cap: 15, room: '研学教室' },
            { time: '7/18 下午', theme: '活体标本+声纹/痕迹', age: '7–12岁', cap: 30, room: '研学教室/标本区' },
            { time: '7/19 上午', theme: '带谱可视化走廊', age: '7–12岁', cap: 30, room: '带谱装置区' },
            { time: '7/19 下午', theme: '公民科学家·生物多样性监测', age: '7–12岁', cap: 30, room: '园区内样线' }
          ]
        } },
      { id: 'act_mp', type: 'mianpiao', title: '免票活动日', emoji: '🎟️', desc: '免费预约进园名额，体验园区自然活动', status: 'online', config: { days: ['本周六', '本周日'] } },
      { id: 'act_dean', type: 'dean', title: '名誉院长选举', emoji: '🗳️', desc: '投票选出你心中的名誉院长，当选者获专属服装 + 2 个月身份 + 进园全免费', status: 'online', config: { cands: [
        { id: 'c1', name: '候选人 A', emoji: '🧑', bio: '自然教育爱好者' },
        { id: 'c2', name: '候选人 B', emoji: '👩', bio: '亲子研学达人' },
        { id: 'c3', name: '候选人 C', emoji: '🧓', bio: '生态摄影前辈' },
        { id: 'c4', name: '候选人 D', emoji: '👨', bio: '户外领队' }
      ] } },
      { id: 'act_contest', type: 'contest', title: '自然记录大赛', emoji: '📸', desc: '上传你的自然照片 / 视频作品，优胜者获专属服装 + 2 个月名誉院长 + 进园全免费', status: 'online', config: {} },
      { id: 'act_yejing', type: 'yanxue', title: '夜观昆虫', emoji: '🦗', status: 'offline',
        desc: '入夜后园区内观察萤火虫/蛾类/鸣虫，听声辨虫，安全灯光不扰自然。',
        location: '园区内 · 夜观步道', capacity: '≤20 组家庭/场', deadline: '活动前 2 天',
        rules: '未成年人须监护人陪同；禁用强光灯', tags: '亲子,夜观,自然',
        config: { sessions: ['周五 夜场 19:30–21:00', '周六 夜场 19:30–21:00'] } },
      { id: 'act_biji', type: 'yanxue', title: '自然笔记营', emoji: '📓', status: 'offline',
        desc: '用画笔+文字记录园区物种，完成个人自然观察手册。',
        location: '园区内 · 研学教室', capacity: '≤25 人/场', deadline: '活动前 3 天',
        rules: '低龄须监护人陪同', tags: '手作,观察,亲子',
        config: { sessions: ['周六 上午', '周日 上午'] } },
      { id: 'act_nonggeng', type: 'yanxue', title: '农耕体验日', emoji: '🌾', status: 'offline',
        desc: '园区内微型农园：播种/堆肥/收获，理解食物与土地。',
        location: '园区内 · 农园体验区', capacity: '≤30 人/场', deadline: '活动前 3 天',
        rules: '着轻便衣物；监护人陪同', tags: '亲子,劳作,自然',
        config: { sessions: ['周六 上午', '周日 下午'] } }
    ],
    votes: [],
    contests: [],
    verifyLog: [],
    notifications: []
  };
}
let DB;
let dataExisted = false;
try {
  DB = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  dataExisted = true;
} catch (e) {
  DB = defaultDB();
}
function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2)); }
if (!dataExisted) save();

// ---------- 工具 ----------
function parseId(id) {
  if (!/^\d{17}[\dX]$/.test(id)) return { valid: false };
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const c = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let s = 0;
  for (let i = 0; i < 17; i++) s += (+id[i]) * w[i];
  if (c[s % 11] !== id[17]) return { valid: false };
  const y = +id.slice(6, 10), m = +id.slice(10, 12), d = +id.slice(12, 14);
  const birth = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const gender = (+id[16]) % 2 === 1 ? '男' : '女';
  const age = Math.floor((Date.now() - new Date(y, m - 1, d)) / 31557600000);
  return { valid: true, birth, gender, age };
}
function maskID(id) { return id.slice(0, 6) + '********' + id.slice(-4); }
function uid() { return 'u' + crypto.randomBytes(4).toString('hex'); }
function bid() { return 'b' + crypto.randomBytes(4).toString('hex'); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${crypto.scryptSync(String(password), salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, expected] = stored.split('$');
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
function issueSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { uid: user.uid, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return token;
}
function sessionUser(token) {
  const item = sessions.get(token);
  if (!item || item.expiresAt < Date.now()) { if (item) sessions.delete(token); return null; }
  return DB.users.find(u => u.uid === item.uid) || null;
}
function requestUser(req, uid) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const user = sessionUser(token);
  return user && user.uid === uid ? user : null;
}
function notify(uid, type, message, bookingId = null) {
  if (!Array.isArray(DB.notifications)) DB.notifications = [];
  DB.notifications.push({ id: 'n' + crypto.randomBytes(4).toString('hex'), uid, type, message, bookingId, read: false, at: Date.now() });
}
function genCode(type) {
  const p = { yanxue: 'YX', mianpiao: 'MP', dean: 'YD', contest: 'CJ' }[type] || 'CD';
  return p + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}
function normalizedParticipants(user, raw) {
  const list = Array.isArray(raw) && raw.length ? raw : [{ name: user.name, idMask: user.idMask, age: user.age, guardian: user.guardian }];
  if (list.length > 20) return { error: '单次预约人数不能超过20人' };
  const participants = list.map((p, i) => ({
    name: String(p.name || (i === 0 ? user.name : '')).trim(),
    idMask: p.id ? maskID(String(p.id)) : String(p.idMask || '').slice(0, 20),
    age: Number.isFinite(Number(p.age)) ? Number(p.age) : null,
    guardian: Boolean(p.guardian)
  }));
  if (participants.some(p => !p.name)) return { error: '每位参加人都必须填写姓名' };
  return { participants };
}
function sessionInfo(act, date) {
  const details = act.config && Array.isArray(act.config.sessionDetail) ? act.config.sessionDetail : [];
  const hit = details.find(s => s.time === date || String(s.time).includes(String(date || '')));
  const capacity = hit && Number(hit.cap);
  return { key: date || 'default', capacity: Number.isFinite(capacity) ? capacity : null };
}
function activeBookings(actId, sessionKey) {
  return DB.bookings.filter(b => b.actId === actId && (b.sessionKey || b.date || 'default') === sessionKey && b.status !== 'cancelled');
}
function bookedSeats(actId, sessionKey) {
  return activeBookings(actId, sessionKey).reduce((sum, b) => sum + (Array.isArray(b.participants) && b.participants.length ? b.participants.length : 1), 0);
}
function publicUser(u) { const { pwd, pwdHash, ...rest } = u; return rest; }
function isAdmin(t) { return t === ADMIN_TOKEN; }

const sessions = new Map();

// ---------- SSE ----------
const sseClients = [];
function broadcast(type, extra) {
  const payload = `event: upd\ndata: ${JSON.stringify({ type, extra: extra || {} })}\n\n`;
  sseClients.forEach(c => { try { c.write(payload); } catch (e) {} });
}

// ---------- HTTP 基础 ----------
function send(res, code, obj, headers) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }, headers || {}));
  res.end(JSON.stringify(obj));
}
function sendFile(res, file) {
  const p = path.join(ROOT, file);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(file);
    const ct = ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  });
}
function readBody(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', d => buf += d);
    req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { resolve({}); } });
  });
}

// ---------- 业务：统计 ----------
function stats() {
  const onlineActs = DB.activities.filter(a => a.status === 'online').length;
  const deanVotes = DB.votes.length;
  const contestWorks = DB.contests.length;
  const winners = DB.contests.filter(c => c.isWinner).length;
  const pending = DB.bookings.filter(b => b.status === 'pending').length;
  const verified = DB.bookings.filter(b => b.status === 'verified').length;
  const yanxue = DB.bookings.filter(b => b.type === 'yanxue').length;
  const mianpiao = DB.bookings.filter(b => b.type === 'mianpiao').length;
  return { totalUsers: DB.users.length, totalBookings: DB.bookings.length, pending, verified, yanxue, mianpiao, onlineActs, totalActs: DB.activities.length, deanVotes, contestWorks, winners, verifyCount: DB.verifyLog.length };
}
function deanTally() {
  const act = DB.activities.find(a => a.type === 'dean');
  if (!act) return [];
  return act.config.cands.map(c => ({ ...c, votes: DB.votes.filter(v => v.candId === c.id).length }));
}

// ---------- 路由 ----------
const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  const p = u.pathname;
  const q = u.query;
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }

  // SSE 实时流（后台）
  if (p === '/api/stream' && method === 'GET') {
    if (!isAdmin(q.token)) { res.writeHead(403); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write(`retry: 3000\n\n`);
    const client = res;
    sseClients.push(client);
    const ping = setInterval(() => { try { client.write(`event: hb\ndata: {}\n\n`); } catch (e) {} }, 25000);
    req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
    return;
  }

  // 静态文件
  if (p === '/' || p === '/index.html' || p === '/前台') return sendFile(res, '用户前台.html');
  if (p === '/admin.html' || p === '/admin' || p === '/admin/' || p === '/管理后台') return sendFile(res, '管理后台.html');
  if (p === '/healthz') return send(res, 200, { ok: true });

  if (!p.startsWith('/api/')) { res.writeHead(404); return res.end('not found'); }

  // ---- API ----
  const body = (method === 'POST') ? await readBody(req) : {};

  // ping
  if (p === '/api/ping' && method === 'GET') return send(res, 200, { ok: true, mode: 'server' });

  // 公共活动列表
  if (p === '/api/activities' && method === 'GET') {
    const list = DB.activities.filter(a => a.status === 'online').map(a => ({ id: a.id, type: a.type, title: a.title, emoji: a.emoji, desc: a.desc, location: a.location || '', capacity: a.capacity || '', deadline: a.deadline || '', rules: a.rules || '', tags: a.tags || '', config: a.config }));
    return send(res, 200, { ok: true, activities: list });
  }
  // 活动详情
  const actMatch = p.match(/^\/api\/activity\/([\w-]+)$/);
  if (actMatch && method === 'GET') {
    const a = DB.activities.find(x => x.id === actMatch[1]);
    if (!a) return send(res, 404, { ok: false, error: '活动不存在' });
    return send(res, 200, { ok: true, activity: a });
  }
  // 注册
  if (p === '/api/register' && method === 'POST') {
    const b = body;
    if (!b.phone || !b.pwd || !b.name || !b.id) return send(res, 400, { ok: false, error: '手机号/密码/姓名/身份证均必填' });
    if (DB.users.some(u => u.phone === b.phone)) return send(res, 400, { ok: false, error: '该手机号已注册' });
    const id = parseId(b.id);
    if (!id.valid) return send(res, 400, { ok: false, error: '身份证号无效（校验未通过）' });
    let guardian = null;
    if (id.age < MINOR_AGE || id.age >= ELDER_AGE) {
      if (!b.guardianName || !b.guardianId || !b.guardianPhone) return send(res, 400, { ok: false, error: '未成年或高龄须填写监护人信息' });
      const gid = parseId(b.guardianId);
      if (!gid.valid) return send(res, 400, { ok: false, error: '监护人身份证号无效' });
      guardian = { name: b.guardianName, idMask: maskID(b.guardianId), phone: b.guardianPhone };
    }
    const user = { uid: uid(), phone: b.phone, pwdHash: hashPassword(b.pwd), name: b.name, idMask: maskID(b.id), birth: id.birth, age: id.age, gender: id.gender, guardian, role: 'user', createdAt: Date.now() };
    DB.users.push(user); save();
    broadcast('user_registered', { name: user.name });
    return send(res, 200, { ok: true, uid: user.uid, token: issueSession(user), user: publicUser(user) });
  }
  // 登录
  if (p === '/api/login' && method === 'POST') {
    const b = body;
    const user = DB.users.find(u => u.phone === b.phone);
    if (!user) return send(res, 401, { ok: false, error: '手机号或密码错误' });
    const valid = user.pwdHash ? verifyPassword(b.pwd, user.pwdHash) : user.pwd === b.pwd;
    if (!valid) return send(res, 401, { ok: false, error: '手机号或密码错误' });
    if (!user.pwdHash) { user.pwdHash = hashPassword(b.pwd); delete user.pwd; save(); }
    return send(res, 200, { ok: true, uid: user.uid, token: issueSession(user), user: publicUser(user) });
  }
  // 我的
  const meMatch = p.match(/^\/api\/me\/([\w-]+)$/);
  if (meMatch && method === 'GET') {
    const user = DB.users.find(u => u.uid === meMatch[1]);
    if (!user) return send(res, 404, { ok: false, error: '用户不存在' });
    if (!requestUser(req, user.uid)) return send(res, 401, { ok: false, error: '用户会话无效或已过期' });
    return send(res, 200, { ok: true, user: publicUser(user), bookings: DB.bookings.filter(b => b.uid === user.uid), votes: DB.votes.filter(v => v.uid === user.uid), contests: DB.contests.filter(c => c.uid === user.uid), notifications: (DB.notifications || []).filter(n => n.uid === user.uid).slice(-50).reverse() });
  }
  const notificationMatch = p.match(/^\/api\/notifications\/([\w-]+)$/);
  if (notificationMatch && method === 'GET') {
    if (!requestUser(req, notificationMatch[1])) return send(res, 401, { ok: false, error: '用户会话无效或已过期' });
    return send(res, 200, { ok: true, notifications: (DB.notifications || []).filter(n => n.uid === notificationMatch[1]).slice(-50).reverse() });
  }
  if (p === '/api/notifications/read' && method === 'POST') {
    if (!requestUser(req, body.uid)) return send(res, 401, { ok: false, error: '用户会话无效或已过期' });
    (DB.notifications || []).filter(n => n.uid === body.uid && !body.id || n.id === body.id).forEach(n => { n.read = true; });
    save(); return send(res, 200, { ok: true });
  }
  // 预约
  if (p === '/api/booking' && method === 'POST') {
    const b = body;
    const user = requestUser(req, b.uid);
    if (!user) return send(res, 401, { ok: false, error: '用户会话无效或已过期' });
    const act = DB.activities.find(a => a.id === b.actId && a.status === 'online');
    if (!act) return send(res, 400, { ok: false, error: '活动不存在或已下架' });
    if (act.type === 'dean' || act.type === 'contest') return send(res, 400, { ok: false, error: '该活动无需预约' });
    const session = sessionInfo(act, b.date || (act.config.sessions ? act.config.sessions[0] : ''));
    const normalized = normalizedParticipants(user, b.participants);
    if (normalized.error) return send(res, 400, { ok: false, error: normalized.error });
    if (DB.bookings.some(x => x.uid === user.uid && x.actId === act.id && (x.sessionKey || x.date || 'default') === session.key && x.status !== 'cancelled')) return send(res, 400, { ok: false, error: '您已预约该活动场次' });
    if (session.capacity !== null && bookedSeats(act.id, session.key) + normalized.participants.length > session.capacity) return send(res, 409, { ok: false, error: `该场次名额不足，剩余${Math.max(0, session.capacity - bookedSeats(act.id, session.key))}席` });
    const code = genCode(act.type);
    const booking = { id: bid(), code, uid: user.uid, actId: act.id, actTitle: act.title, type: act.type, date: session.key, sessionKey: session.key, name: user.name, idMask: user.idMask, guardian: user.guardian, participants: normalized.participants, credentialPayload: `booking:${code}`, status: 'pending', createdAt: Date.now(), verifiedAt: null, cancelledAt: null };
    DB.bookings.push(booking); notify(user.uid, 'booking_created', `预约成功：${booking.actTitle}（${booking.date}）`, booking.id); save();
    broadcast('booking_created', { code });
    return send(res, 200, { ok: true, booking });
  }
  // 取消预约：仅允许责任用户取消待核销订单，并释放场次名额
  if (p === '/api/booking/cancel' && method === 'POST') {
    const user = requestUser(req, body.uid);
    const booking = DB.bookings.find(b => b.id === body.bookingId && b.uid === body.uid);
    if (!user) return send(res, 401, { ok: false, error: '用户会话无效或已过期' });
    if (!booking) return send(res, 404, { ok: false, error: '预约不存在' });
    if (booking.status === 'verified') return send(res, 400, { ok: false, error: '已核销预约不可取消' });
    if (booking.status === 'cancelled') return send(res, 400, { ok: false, error: '该预约已取消' });
    booking.status = 'cancelled'; booking.cancelledAt = Date.now(); notify(user.uid, 'booking_cancelled', `预约已取消：${booking.actTitle}（${booking.date}）`, booking.id); save(); broadcast('booking_cancelled', { code: booking.code });
    return send(res, 200, { ok: true, booking });
  }
  // 投票
  if (p === '/api/vote' && method === 'POST') {
    const b = body;
    const user = requestUser(req, b.uid);
    if (!user) return send(res, 401, { ok: false, error: '用户会话无效或已过期' });
    const act = DB.activities.find(a => a.id === b.actId);
    if (!act || act.type !== 'dean') return send(res, 400, { ok: false, error: '非选举活动' });
    if (DB.votes.some(v => v.uid === user.uid && v.actId === act.id)) return send(res, 400, { ok: false, error: '您已投过票' });
    if (!act.config.cands.some(c => c.id === b.candId)) return send(res, 400, { ok: false, error: '候选人不存在' });
    DB.votes.push({ uid: user.uid, actId: act.id, candId: b.candId, at: Date.now() }); save();
    broadcast('vote_cast', { candId: b.candId });
    return send(res, 200, { ok: true, tally: deanTally() });
  }
  // 大赛投稿
  if (p === '/api/contest' && method === 'POST') {
    const b = body;
    const user = requestUser(req, b.uid);
    if (!user) return send(res, 401, { ok: false, error: '用户会话无效或已过期' });
    const work = { id: 'w' + crypto.randomBytes(3).toString('hex'), uid: user.uid, name: user.name, title: b.title || '', desc: b.desc || '', mediaType: b.mediaType || 'photo', mediaUrl: (b.mediaUrl || '').slice(0, 2000000), isWinner: false, at: Date.now() };
    DB.contests.push(work); save();
    broadcast('contest_submitted', { title: work.title });
    return send(res, 200, { ok: true, work });
  }

  // ---------- 后台接口（需 token） ----------
  if (p.startsWith('/api/admin/')) {
    const token = (method === 'GET') ? q.token : body.token;
    if (!isAdmin(token)) return send(res, 403, { ok: false, error: '无权限' });

    if (p === '/api/admin/data' && method === 'GET') {
      return send(res, 200, { ok: true, stats: stats(), deanTally: deanTally(), users: DB.users.map(publicUser), bookings: DB.bookings, activities: DB.activities, votes: DB.votes, contests: DB.contests, verifyLog: DB.verifyLog });
    }
    if (p === '/api/admin/verify' && method === 'POST') {
      const code = (body.code || '').trim().toUpperCase();
      const bk = DB.bookings.find(b => b.code.toUpperCase() === code);
      if (!bk) return send(res, 404, { ok: false, error: '凭证码不存在' });
      if (bk.status === 'verified') return send(res, 400, { ok: false, error: '该凭证已核销' });
      if (bk.status === 'cancelled') return send(res, 400, { ok: false, error: '该凭证已取消' });
      bk.status = 'verified'; bk.verifiedAt = Date.now();
      DB.verifyLog.push({ code: bk.code, actTitle: bk.actTitle, name: bk.name, at: Date.now(), operator: 'admin' });
      save(); broadcast('verify_done', { code: bk.code });
      return send(res, 200, { ok: true, booking: bk });
    }
    if (p === '/api/admin/activity' && method === 'POST') {
      const b = body;
      if (b.action === 'toggle') {
        const a = DB.activities.find(x => x.id === b.id); if (!a) return send(res, 404, { ok: false }); a.status = a.status === 'online' ? 'offline' : 'online'; save(); broadcast('activity_changed');
        return send(res, 200, { ok: true, activity: a });
      }
      if (b.action === 'delete') {
        DB.activities = DB.activities.filter(x => x.id !== b.id); save(); broadcast('activity_changed');
        return send(res, 200, { ok: true });
      }
      if (b.action === 'create') {
        const a = {
          id: 'act_' + crypto.randomBytes(3).toString('hex'),
          type: b.type || 'yanxue',
          title: b.title || '新活动',
          emoji: b.emoji || '📌',
          desc: b.desc || '',
          location: b.location || '',
          capacity: b.capacity || '',
          deadline: b.deadline || '',
          rules: b.rules || '',
          tags: b.tags || '',
          status: 'online',
          config: (b.config && typeof b.config === 'object') ? b.config : {}
        };
        DB.activities.push(a); save(); broadcast('activity_changed');
        return send(res, 200, { ok: true, activity: a });
      }
      return send(res, 400, { ok: false, error: '未知操作' });
    }
    if (p === '/api/admin/winner' && method === 'POST') {
      const w = DB.contests.find(c => c.id === body.workId); if (!w) return send(res, 404, { ok: false });
      w.isWinner = !w.isWinner; save(); broadcast('contest_changed');
      return send(res, 200, { ok: true, work: w });
    }
    if (p === '/api/admin/user' && method === 'DELETE') {
      DB.users = DB.users.filter(u => u.uid !== body.uid); save(); broadcast('user_changed');
      return send(res, 200, { ok: true });
    }
  }

  // 导出 CSV
  const expMatch = p.match(/^\/api\/export\/(\w+)$/);
  if (expMatch && method === 'GET') {
    if (!isAdmin(q.token)) return send(res, 403, { ok: false, error: '无权限' });
    const type = expMatch[1];
    let rows = [], header = [];
    if (type === 'bookings') { header = ['凭证码', '类型', '活动', '场次/日期', '姓名', '脱敏身份证', '监护人', '状态', '预约时间', '核销时间']; rows = DB.bookings.map(b => [b.code, b.type, b.actTitle, b.date, b.name, b.idMask, b.guardian ? b.guardian.name : '', b.status, new Date(b.createdAt).toLocaleString(), b.verifiedAt ? new Date(b.verifiedAt).toLocaleString() : '']); }
    else if (type === 'users') { header = ['UID', '手机号', '姓名', '脱敏身份证', '性别', '年龄', '监护人', '注册时间']; rows = DB.users.map(u => [u.uid, u.phone, u.name, u.idMask, u.gender, u.age, u.guardian ? u.guardian.name : '', new Date(u.createdAt).toLocaleString()]); }
    else if (type === 'dean') { header = ['候选人', '票数']; rows = deanTally().map(c => [c.name, c.votes]); }
    else if (type === 'contest') { header = ['作品ID', '作者', '标题', '描述', '类型', '优胜', '时间']; rows = DB.contests.map(c => [c.id, c.name, c.title, c.desc, c.mediaType, c.isWinner ? '是' : '否', new Date(c.at).toLocaleString()]); }
    else if (type === 'verify') { header = ['凭证码', '活动', '姓名', '核销时间', '操作员']; rows = DB.verifyLog.map(v => [v.code, v.actTitle, v.name, new Date(v.at).toLocaleString(), v.operator]); }
    else return send(res, 400, { ok: false, error: '未知类型' });
    const csv = '﻿' + [header, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}.csv"`, 'Access-Control-Allow-Origin': '*' });
    return res.end(csv);
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 预约小程序后端已启动: http://localhost:${PORT}  (后台: http://localhost:${PORT}/管理后台)`);
});

