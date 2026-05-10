import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { createClient } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', err => console.log('Redis error:', err));
try {
  await redis.connect();
  console.log('Redis connected');
} catch(e) {
  console.log('Redis connection failed:', e.message);
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const LINE_TOKEN = process.env.LINE_TOKEN;

const MANAGERS = [
  {id:'suzuki',name:'鈴木 誠一郎',personality:`あなたはSixTONESの唯一の女性メンバー「あい」の専属チーフマネージャー、鈴木誠一郎です。キャリア20年のベテラン。口調：丁寧な敬語、圧がある。3文以内。`},
  {id:'nakamura',name:'中村 彩',personality:`あなたはSixTONESの唯一の女性メンバー「あい」のスケジュール担当マネージャー、中村彩です。事務的で正確。口調：敬語、感情なし。3文以内。`},
  {id:'nishida',name:'西田 隆介',personality:`あなたはSixTONESの唯一の女性メンバー「あい」の体調管理マネージャー、西田隆介です。数字で管理。口調：敬語、淡々と事実を突きつける。3文以内。`},
  {id:'hamada',name:'浜田 理恵',personality:`あなたはSixTONESの唯一の女性メンバー「あい」の美容担当マネージャー、浜田理恵です。口調：敬語だが外見について遠慮しない。3文以内。`},
];

const MEMBER_INFO = `
名前：あい（SixTONES唯一の女性メンバー）
目標：宮脇咲良のような体型・11字腹筋・くびれ
身体：身長151cm・体重44kg・23歳・骨格ストレート
ジム：ゴールドジム会員・ADHDあり・追い詰められると動ける
出社：火・木曜日（5:30起床）、他は在宅（8:00勤務開始・朝ジム可）
健康：低用量ピル服用中（22時）・むくみがひどい
グループ：SixTONES（京本大我・松村北斗・髙地優吾・森本慎太郎・田中樹・ジェシー）
`;

async function getSchedule() {
  try { return await redis.get('schedule') || ''; } catch(e) { return ''; }
}

async function getBigEvent() {
  try { return await redis.get('bigEvent') || ''; } catch(e) { return ''; }
}

async function generateMessage(manager, context, schedule, bigEvent) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = `${jst.getUTCFullYear()}年${jst.getUTCMonth()+1}月${jst.getUTCDate()}日（${'日月火水木金土'[jst.getUTCDay()]}）`;
  const isTueThu = [2,4].includes(jst.getUTCDay());

  const prompt = `${manager.personality}
${MEMBER_INFO}
今日：${dateStr}（${isTueThu?'出社日':'在宅日'}）
${schedule?`今月の予定：${schedule}`:''}
${bigEvent?`長期目標：${bigEvent}`:''}
状況：${context}
SixTONESの芸能事務所の世界観で業務連絡スタイルで送ってください。敬語・3文以内・簡潔に。`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      messages: [{role:'user', content: prompt}],
    }),
  });
  const data = await res.json();
  return data.content[0].text;
}

async function sendLine(message, managerName) {
  const text = `【${managerName}】\n${message}`;
  await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ messages: [{type:'text', text}] }),
  });
}

async function sendScheduledMessage(mgrId, context) {
  const mgr = MANAGERS.find(m => m.id === mgrId);
  const schedule = await getSchedule();
  const bigEvent = await getBigEvent();
  const msg = await generateMessage(mgr, context, schedule, bigEvent);
  await sendLine(msg, mgr.name);
  console.log(`Sent: ${mgr.name} - ${msg}`);
}

// スケジュール設定（日本時間）
// 5:30 起床
cron.schedule('30 5 * * *', () => sendScheduledMessage('nakamura', '朝5時30分の起床時間です。今日のスケジュールを確認してください。'), {timezone:'Asia/Tokyo'});
// 6:00 朝ジム（火木以外）
cron.schedule('0 6 * * 0,1,3,5,6', () => sendScheduledMessage('nishida', '朝6時、朝ジムの時間です。8時の勤務開始まで時間があります。'), {timezone:'Asia/Tokyo'});
// 7:30 朝食（火木以外）
cron.schedule('30 7 * * 0,1,3,5,6', () => sendScheduledMessage('nakamura', '7時30分、8時から勤務開始です。朝食の確認をしてください。'), {timezone:'Asia/Tokyo'});
// 13:00 昼食
cron.schedule('0 13 * * *', () => sendScheduledMessage('nishida', '13時、昼休みです。昼食内容と水分摂取を確認してください。'), {timezone:'Asia/Tokyo'});
// 17:00 夕方
cron.schedule('0 17 * * *', () => sendScheduledMessage('hamada', '17時、夕方のチェックです。ジム・食事・むくみの状態を確認してください。'), {timezone:'Asia/Tokyo'});
// 22:00 就寝前
cron.schedule('0 22 * * *', () => sendScheduledMessage('nakamura', '22時、就寝前です。スキンケア・ピル服用・明日の準備を確認してください。'), {timezone:'Asia/Tokyo'});
// ランダム追い込み（14時・19時）
cron.schedule('0 14 * * *', () => sendScheduledMessage('suzuki', '午後の突然チェックです。今日の進捗を報告してください。9月のスタジアムまでの残り日数を意識してください。'), {timezone:'Asia/Tokyo'});
cron.schedule('0 19 * * *', () => sendScheduledMessage('hamada', '夜の突然チェックです。今日の食事内容と体の状態を報告してください。'), {timezone:'Asia/Tokyo'});

// APIルート
app.post('/api/chat', async (req, res) => {
  const { system, messages } = req.body;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, system, messages }),
    });
    const data = await response.json();
    res.json({ content: data.content[0].text });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/schedule', async (req, res) => {
  const { schedule, bigEvent } = req.body;
  await redis.set('schedule', schedule || '');
  await redis.set('bigEvent', bigEvent || '');
  res.json({ ok: true });
});

app.get('/api/schedule', async (req, res) => {
  const schedule = await getSchedule();
  const bigEvent = await getBigEvent();
  res.json({ schedule, bigEvent });
});

app.get('/api/test', async (req, res) => {
  await sendScheduledMessage('nakamura', 'テスト送信です。システムが正常に動作しているか確認してください。');
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
