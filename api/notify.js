const line_token = process.env.LINE_TOKEN;
const anthropic_key = process.env.ANTHROPIC_KEY;

const MANAGERS = [
  {id:'suzuki',name:'鈴木 誠一郎',role:'チーフマネージャー',
   personality:`あなたはSixTONESの唯一の女性メンバー「あい」の専属チーフマネージャー、鈴木誠一郎です。キャリア20年のベテラン。滅多に連絡しないが来たら重要。口調：丁寧な敬語、圧がある、感情を出さない。3文以内で簡潔に。`},
  {id:'nakamura',name:'中村 彩',role:'スケジュール担当',
   personality:`あなたはSixTONESの唯一の女性メンバー「あい」のスケジュール担当マネージャー、中村彩です。事務的で正確。口調：敬語、感情なし、業務連絡に徹する。3文以内で簡潔に。`},
  {id:'nishida',name:'西田 隆介',role:'体調管理担当',
   personality:`あなたはSixTONESの唯一の女性メンバー「あい」の体調管理マネージャー、西田隆介です。数字とデータで管理。口調：敬語、淡々と事実を突きつける。3文以内で簡潔に。`},
  {id:'hamada',name:'浜田 理恵',role:'美容・イメージ担当',
   personality:`あなたはSixTONESの唯一の女性メンバー「あい」の美容・イメージ担当マネージャー、浜田理恵です。美容・体型・肌のプロ。口調：敬語だが外見について遠慮しない。3文以内で簡潔に。`},
];

const SCHEDULE = [
  {hour:20,min:30,mgr:'nakamura',context:'朝5時30分の起床時間です。今日は出社日かリモート日か確認してください。'},
  {hour:21,min:0,mgr:'nishida',context:'朝6時、朝ジムの時間です。8時の勤務開始まで時間があります。',notTueThu:true},
  {hour:21,min:30,mgr:'nakamura',context:'7時30分、8時から勤務開始です。朝食の確認をしてください。',notTueThu:true},
  {hour:4,min:0,mgr:'nishida',context:'13時、昼休みです。昼食内容と午前中の水分摂取を確認してください。'},
  {hour:8,min:0,mgr:'hamada',context:'17時、夕方のチェックです。今日のジム・食事・むくみの状態を確認してください。'},
  {hour:13,min:0,mgr:'nakamura',context:'22時、就寝前です。スキンケア・ピル服用・明日の準備を確認してください。'},
];

const MEMBER_INFO = `
【担当アーティスト情報】
名前：あい（SixTONES唯一の女性メンバー）
目標：宮脇咲良のような体型・11字腹筋・くびれ
身体：身長151cm・体重44kg・23歳・骨格ストレート
ジム：ゴールドジム会員
特性：ADHDあり・追い詰められると動ける・褒められると継続できる
出社：火・木曜日（5:30起床）、他は在宅（8:00勤務開始・朝ジム可）
健康：低用量ピル服用中（22時）・むくみがひどい
グループ：SixTONES（京本大我・松村北斗・髙地優吾・森本慎太郎・田中樹・ジェシー）
`;

async function generateMessage(manager, context) {
  const today = new Date();
  const jst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = `${jst.getUTCFullYear()}年${jst.getUTCMonth()+1}月${jst.getUTCDate()}日（${'日月火水木金土'[jst.getUTCDay()]}）`;
  const day = jst.getUTCDay();
  const isTueThu = day === 2 || day === 4;
  const dayType = isTueThu ? '出社日' : 'リモート・在宅日';

  const prompt = `${manager.personality}

${MEMBER_INFO}

今日：${dateStr}（${dayType}）

以下の状況でメッセージを送ってください：
${context}

SixTONESの芸能事務所の世界観で、業務連絡スタイルで送ってください。必要に応じてメンバーの名前（松村さん、髙地さんなど）や仕事内容に絡めてください。敬語・3文以内・簡潔に。`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropic_key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      messages: [{role: 'user', content: prompt}],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

async function sendLine(message, managerName) {
  const text = `【${managerName}】\n${message}`;
  const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${line_token}`,
    },
    body: JSON.stringify({
      messages: [{type: 'text', text}]
    }),
  });
  return res.status;
}

export default async function handler(req, res) {
  const isTest = req.query.test === 'true';

  if (isTest) {
    try {
      const mgr = MANAGERS[1];
      const msg = await generateMessage(mgr, '午後のテスト送信です。システムが正常に動作しているか確認してください。');
      const status = await sendLine(msg, mgr.name);
      return res.status(200).json({ok: true, sent: true, message: msg, lineStatus: status});
    } catch(e) {
      return res.status(500).json({ok: false, error: e.message});
    }
  }

  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = jst.getUTCHours();
  const min = jst.getUTCMinutes();
  const day = jst.getUTCDay();
  const isTueThu = day === 2 || day === 4;

  let sent = false;
  const results = [];

  for (const s of SCHEDULE) {
    if (s.hour !== hour || Math.abs(s.min - min) > 2) continue;
    if (s.notTueThu && isTueThu) continue;

    const mgr = MANAGERS.find(m => m.id === s.mgr);
    try {
      const msg = await generateMessage(mgr, s.context);
      const lineStatus = await sendLine(msg, mgr.name);
      results.push({mgr: mgr.name, message: msg, lineStatus});
      sent = true;
    } catch(e) {
      results.push({mgr: mgr.name, error: e.message});
    }
  }

  res.status(200).json({ok: true, sent, hour, min, results});
}
