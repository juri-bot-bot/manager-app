const line_token = process.env.LINE_TOKEN;

const MANAGERS = [
  {id:'suzuki',name:'鈴木 誠一郎',role:'チーフマネージャー'},
  {id:'nakamura',name:'中村 彩',role:'スケジュール担当'},
  {id:'nishida',name:'西田 隆介',role:'体調管理担当'},
  {id:'hamada',name:'浜田 理恵',role:'美容・イメージ担当'},
];

const SCHEDULE = [
  {hour:20,min:30,mgr:'nakamura',msg:'おはようございます。5時30分です。今日も一日よろしくお願いします。'},
  {hour:21,min:0,mgr:'nishida',msg:'朝ジムの時間です。8時の勤務開始まで時間があります。今すぐ出発してください。',notTueThu:true},
  {hour:21,min:30,mgr:'nakamura',msg:'8時から勤務です。朝食は済みましたか。報告してください。',notTueThu:true},
  {hour:4,min:0,mgr:'nishida',msg:'昼休みです。昼食の内容を報告してください。'},
  {hour:6,min:0,mgr:'nishida',msg:'夕方のチェックです。今日のジム・食事・水分の状況を報告してください。'},
  {hour:8,min:0,mgr:'hamada',msg:'スキンケアの時間です。クレンジング・洗顔・保湿を丁寧に行ってください。ピルも忘れずに飲んでください。'},
  {hour:13,min:0,mgr:'nakamura',msg:'就寝前チェックです。スキンケア・ピル・明日の準備・スマホを置く・22:30就寝。報告してください。'},
];

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
    const mgr = MANAGERS[1];
    const status = await sendLine('サーバーのテストです。マネージャーシステムが正常に動作しています。', mgr.name);
    return res.status(200).json({ok: true, sent: true, lineStatus: status});
  }

  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = jst.getUTCHours();
  const min = jst.getUTCMinutes();
  const day = jst.getUTCDay();
  const isTueThu = day === 2 || day === 4;

  let sent = false;

  for (const s of SCHEDULE) {
    if (s.hour !== hour || Math.abs(s.min - min) > 2) continue;
    if (s.notTueThu && isTueThu) continue;
    const mgr = MANAGERS.find(m => m.id === s.mgr);
    await sendLine(s.msg, mgr.name);
    sent = true;
  }

  res.status(200).json({ok: true, sent, hour, min});
}
