/**
 * 研学活动计划落地脚本
 * 把「7/18–19 周末研学四场」与后续计划活动写入 data.json，
 * 使后台可一键上架。重复执行幂等（按 id 去重，不破坏已有预约/核销数据）。
 *
 * 运行：node 研学计划种子.js   （需在 booking-miniprogram 目录）
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'data.json');
const db = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let changed = 0;
function touch() { changed++; }

// ---------- 1) 充实既有研学活动 act_yx（7/18–19 四场） ----------
const yx = db.activities.find(a => a.id === 'act_yx');
if (yx) {
  yx.title = '周末研学·7/18–19 亲子自然课';
  yx.emoji = '🎒';
  yx.desc = '收票赠课：购门票入园即赠「价值80元·暂定价」园区内自然课（实际免费）。7/18–7/19 四场，不出园、安全亲近高黎贡。';
  yx.location = '园区内 · 专属研学动线区 / 研学教室（与走客动线≥50m 隔离）';
  yx.capacity = '场1 ≤15（3–6岁）｜场2/3/4 ≤30（7–12岁）';
  yx.deadline = '报名截止 2026-07-17 24:00';
  yx.rules = '①收票赠课，购票即赠，不再另收研学费；②到园「门票+预约码」双码核销；③报名收9.9元可退押金（信用良好免押）；④3–6岁须家长全程陪同；⑤雨天切换室内单课（雨备馆≤100人）。';
  yx.tags = '研学,亲子,周末,收票赠课';
  yx.config = {
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
  };
  yx.status = 'online';
  touch();
}

// ---------- 2) 清理乱码测试活动 ----------
const before = db.activities.length;
db.activities = db.activities.filter(a => a.id !== 'act_566acf');
if (db.activities.length < before) touch();

// ---------- 3) 亲子自然课堂去重（保留首个） ----------
const dup = db.activities.filter(a => a.title === '亲子自然课堂');
if (dup.length > 1) {
  const keep = dup[0].id;
  db.activities = db.activities.filter(a => !(a.title === '亲子自然课堂' && a.id !== keep));
  touch();
}

// ---------- 4) 新增后续计划活动（offline 草稿，后台可一键上架） ----------
function addIfMissing(a) {
  if (!db.activities.some(x => x.id === a.id)) { db.activities.push(a); touch(); }
}
addIfMissing({
  id: 'act_yejing', type: 'yanxue', title: '夜观昆虫', emoji: '🦗',
  desc: '入夜后园区内观察萤火虫/蛾类/鸣虫，听声辨虫，安全灯光不扰自然。',
  location: '园区内 · 夜观步道', capacity: '≤20 组家庭/场', deadline: '活动前 2 天',
  rules: '未成年人须监护人陪同；禁用强光灯', tags: '亲子,夜观,自然', status: 'offline',
  config: { sessions: ['周五 夜场 19:30–21:00', '周六 夜场 19:30–21:00'] }
});
addIfMissing({
  id: 'act_biji', type: 'yanxue', title: '自然笔记营', emoji: '📓',
  desc: '用画笔+文字记录园区物种，完成个人自然观察手册。',
  location: '园区内 · 研学教室', capacity: '≤25 人/场', deadline: '活动前 3 天',
  rules: '低龄须监护人陪同', tags: '手作,观察,亲子', status: 'offline',
  config: { sessions: ['周六 上午', '周日 上午'] }
});
addIfMissing({
  id: 'act_nonggeng', type: 'yanxue', title: '农耕体验日', emoji: '🌾',
  desc: '园区内微型农园：播种/堆肥/收获，理解食物与土地。',
  location: '园区内 · 农园体验区', capacity: '≤30 人/场', deadline: '活动前 3 天',
  rules: '着轻便衣物；监护人陪同', tags: '亲子,劳作,自然', status: 'offline',
  config: { sessions: ['周六 上午', '周日 下午'] }
});

fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
console.log(`✅ 研学计划已落地。变更项=${changed}`);
console.log('活动清单：');
db.activities.forEach(a => console.log(`  - [${a.status}] ${a.id}  ${a.title}  (${a.type})`));

