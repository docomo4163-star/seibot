// youtube-notifier.js
// YouTubeチャンネルで「配信開始」「動画・ショート投稿」があったら Discord に URL を自動投稿する
// ・APIキー不要（YouTubeの公開RSSを数分おきにチェック）
// ・保存ファイルを使わない（Renderの再起動で消えても大丈夫なように、
//   投稿済みかどうかは通知チャンネルの過去メッセージから判断する）

const DEFAULTS = {
  youtubeChannelId: 'UCYiZRyFS6zCGbLTjSBIu6sQ', // チャンネル「せい」
  intervalMinutes: 5,                            // チェック間隔（分）
  catchUpHours: 3,     // 起動時、bot停止中に出た動画をさかのぼって貼る範囲（時間）
  mention: '',         // 例: '@everyone' や '<@&ロールID>'（不要なら空）
};

async function fetchFeed(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RSS取得失敗: ${res.status}`);
  const xml = await res.text();

  const entries = [];
  for (const block of xml.split('<entry>').slice(1)) {
    const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1];
    if (id) {
      entries.push({
        id,
        title: decodeXml(title),
        publishedAt: published ? new Date(published).getTime() : 0,
      });
    }
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

// 通知チャンネルの最近のメッセージから、すでに貼った動画IDを集める
async function collectPostedIds(channel, botUserId) {
  const ids = new Set();
  const messages = await channel.messages.fetch({ limit: 100 });
  for (const msg of messages.values()) {
    if (msg.author.id !== botUserId) continue;
    for (const m of msg.content.matchAll(/(?:watch\?v=|shorts\/)([\w-]{11})/g)) {
      ids.add(m[1]);
    }
  }
  return ids;
}

function startYouTubeNotifier(client, options) {
  const opt = { ...DEFAULTS, ...options };
  if (!opt.discordChannelId) throw new Error('discordChannelId を指定してください');

  let posted = null; // 投稿済みID（起動時にチャンネル履歴から復元）
  let startedAt = Date.now();
  let running = false;

  async function check() {
    if (running) return;
    running = true;
    try {
      const channel = await client.channels.fetch(opt.discordChannelId);
      const entries = await fetchFeed(opt.youtubeChannelId);

      if (!posted) {
        posted = await collectPostedIds(channel, client.user.id);
        console.log(`[YouTube通知] 起動: 投稿済み ${posted.size} 件をチャンネル履歴から確認`);
      }

      // 古い順に処理
      for (const entry of [...entries].reverse()) {
        if (posted.has(entry.id)) continue;

        const type = await detectType(entry.id);
        if (type === 'upcoming') continue; // 配信予定枠 → 始まったら貼る

        // 起動直後は古い動画を貼らない（配信中のものと、最近出たものだけ貼る）
        const tooOld = entry.publishedAt < startedAt - opt.catchUpHours * 60 * 60 * 1000;
        if (type !== 'live' && tooOld) {
          posted.add(entry.id);
          continue;
        }

        await channel.send(buildMessage(type, entry, opt.mention));
        posted.add(entry.id);
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
