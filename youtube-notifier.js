// youtube-notifier.js
// YouTubeチャンネルで「配信開始」「動画・ショート投稿」があったら Discord に URL を自動投稿する
// APIキー不要（YouTubeの公開RSSを数分おきにチェック）

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  youtubeChannelId: 'UCYiZRyFS6zCGbLTjSBIu6sQ', // チャンネル「せい」
  intervalMinutes: 5,                            // チェック間隔（分）
  stateFile: path.join(__dirname, 'youtube-posted.json'), // 投稿済みIDの保存先
  mention: '',                                   // 例: '@everyone' や '<@&ロールID>'（不要なら空）
};

function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null; // 初回
  }
}

function saveState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

async function fetchFeed(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RSS取得失敗: ${res.status}`);
  const xml = await res.text();

  const entries = [];
  for (const block of xml.split('<entry>').slice(1)) {
    const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    if (id) entries.push({ id, title: decodeXml(title) });
  }
  return entries; // 新しい順
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// 動画の種類を判定: 'live' | 'upcoming' | 'short' | 'video'
async function detectType(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'Accept-Language': 'ja' },
    });
    const html = await res.text();
    if (html.includes('"isLiveNow":true')) return 'live';
    if (html.includes('"isUpcoming":true')) return 'upcoming';
  } catch { /* 判定できなくても投稿は続ける */ }

  try {
    // /shorts/ID がリダイレクトされなければショート
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, { redirect: 'manual' });
    if (res.status === 200) return 'short';
  } catch { /* noop */ }

  return 'video';
}

function buildMessage(type, entry, mention) {
  const head = {
    live: '🔴 配信が始まりました！',
    short: '📱 ショートを投稿しました！',
    video: '🎬 新しい動画を投稿しました！',
  }[type];
  const url = type === 'short'
    ? `https://www.youtube.com/shorts/${entry.id}`
    : `https://www.youtube.com/watch?v=${entry.id}`;
  return [mention, head, `**${entry.title}**`, url].filter(Boolean).join('\n');
}

function startYouTubeNotifier(client, options) {
  const opt = { ...DEFAULTS, ...options };
  if (!opt.discordChannelId) throw new Error('discordChannelId を指定してください');

  let state = loadState(opt.stateFile);
  let running = false;

  async function check() {
    if (running) return;
    running = true;
    try {
      const entries = await fetchFeed(opt.youtubeChannelId);

      // 初回は既存の動画を「投稿済み」として記録するだけ（過去分を大量に貼らない）
      if (!state) {
        state = { posted: entries.map(e => e.id) };
        saveState(opt.stateFile, state);
        console.log(`[YouTube通知] 初期化: 既存 ${entries.length} 件を記録`);
        return;
      }

      const channel = await client.channels.fetch(opt.discordChannelId);

      // 古い順に処理
      for (const entry of [...entries].reverse()) {
        if (state.posted.includes(entry.id)) continue;

        const type = await detectType(entry.id);
        if (type === 'upcoming') continue; // 配信予定枠 → 始まったら貼る

        await channel.send(buildMessage(type, entry, opt.mention));
        state.posted.push(entry.id);
        state.posted = state.posted.slice(-200); // 肥大化防止
        saveState(opt.stateFile, state);
        console.log(`[YouTube通知] 投稿: ${type} ${entry.id}`);
      }
    } catch (err) {
      console.error('[YouTube通知] エラー:', err.message);
    } finally {
      running = false;
    }
  }

  check();
  setInterval(check, opt.intervalMinutes * 60 * 1000);
}

module.exports = { startYouTubeNotifier };
