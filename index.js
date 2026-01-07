// index.js
const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 4000;
const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();

// ===== 設定 =====
const VC_NOTIFY_CHANNEL_ID = '951896358590251028';

const VC_START_IMAGE_URL =
  'https://cdn.discordapp.com/attachments/951896358590251028/1458271291814449254/Gemini_Generated_Image_7mqyub7mqyub7mqy.png?ex=695f0879&is=695db6f9&hm=767d502bbcfee33a17b5908fd2efe50c751c2c4c6f5e2c8ada3efbd746099239&';

const VC_END_IMAGE_URL =
  'https://cdn.discordapp.com/attachments/951896358590251028/1458264783919775774/Gemini_Generated_Image_help4ahelp4ahelp.png?ex=695f0269&is=695db0e9&hm=4dc67c480c7f03da89eb5ce663339b09ca5e2723dc2721ca8dff553cecb1af3e&';

// メッセージ識別タグ（再起動しても履歴から判別できるようにする）
const TAG_START_URL = '[VC_START_URL]';     // 例: [VC_START_URL] vc=12345 https://discord.com/channels/...
const TAG_START_IMG = '[VC_START_IMG]';     // 例: [VC_START_IMG] vc=12345 https://cdn.discordapp.com/...
const TAG_END_IMG   = '[VC_END_IMG]';       // 例: [VC_END_IMG] https://cdn.discordapp.com/...

// ==== 1. Webサーバー ====
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.status(200).send('Bot is running!'));
app.listen(PORT, () => console.log(`✅ Web Server running on port ${PORT}`));

// ==== 2. Bot準備 ====
if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN がありません');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Discordログイン完了: ${c.user.tag}`);
  c.user.setActivity('性的な人生0.91', { type: 0 });

  // ★ 必須：定期クリーンアップ開始（再起動後の残骸を消すため）
  startCleanupJob();
});

// テキスト反応（リプライじゃなく普通送信）
client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;

  if (message.content === 'ping') {
    message.channel.send('pong').catch(console.error);
  }
  if (message.content === 'せいは') {
    message.channel.send('ちんぱん').catch(console.error);
  }
});

// ==== VC検知（開始・終了） ====
// VC開始：招待URL + 開始画像（どちらもタグ＆vcID入り）
// VC終了：開始2つを削除（可能なら）+ 終了画像（タグ付き）送信
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const notifyChannel = guild.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
    if (!notifyChannel || !notifyChannel.isTextBased()) return;

    const oldCh = oldState.channel;
    const newCh = newState.channel;

    // ===== VC開始（最初の1人）=====
    if (newCh && (!oldCh || oldCh.id !== newCh.id) && newCh.members.size === 1) {
      // VCチャンネルIDを埋め込んで送る（再起動後も識別できる）
      await notifyChannel.send(`${TAG_START_URL} vc=${newCh.id} ${newCh.url}`);
      await notifyChannel.send(`${TAG_START_IMG} vc=${newCh.id} ${VC_START_IMAGE_URL}`);
    }

    // ===== VC終了（0人）=====
    if (oldCh && (!newCh || oldCh.id !== newCh.id) && oldCh.members.size === 0) {
      // ここでは「消せたら消す」。消し漏れは定期掃除が回収する。
      await deleteStartPairIfExists(notifyChannel, oldCh.id).catch(() => {});

      // 終了画像はタグ付きで送る（後で“最新だけ残す”判定ができる）
      await notifyChannel.send(`${TAG_END_IMG} ${VC_END_IMAGE_URL}`);
    }
  } catch (err) {
    console.error('[voiceStateUpdate error]', err);
  }
});

client.on('error', (err) => console.error('[CLIENT ERROR]', err));

// ==== ログイン ====
client.login(TOKEN).catch((err) => {
  console.error('❌ Discordログイン失敗:', err);
  process.exit(1);
});

// ==== グローバルエラー ====
process.on('unhandledRejection', (reason) => console.error('🔥 Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('🔥 Uncaught Exception:', err));

/**
 * 指定VCの「開始URL」「開始画像」を通知チャンネルから探して削除する。
 * 直近だけ見ているので、消し漏れは定期掃除が拾う。
 */
async function deleteStartPairIfExists(notifyChannel, vcId) {
  const messages = await notifyChannel.messages.fetch({ limit: 50 });

  const mine = messages.filter((m) => m.author?.id === client.user.id);

  const startUrlMsg = mine.find((m) => typeof m.content === 'string' && m.content.startsWith(TAG_START_URL) && m.content.includes(`vc=${vcId}`));
  const startImgMsg = mine.find((m) => typeof m.content === 'string' && m.content.startsWith(TAG_START_IMG) && m.content.includes(`vc=${vcId}`));

  if (startUrlMsg) await startUrlMsg.delete().catch(() => {});
  if (startImgMsg) await startImgMsg.delete().catch(() => {});
}

/**
 * 1分ごとに掃除：
 * - 再起動してMapが消えても、タグ付きメッセージを履歴から判別して削除できる
 * - VC稼働中（メンバー>=1）の開始メッセージは絶対消さない（開始直後に消える問題の修正）
 * - 終了画像は「最新1件だけ残す」
 */
function startCleanupJob() {
  setInterval(async () => {
    try {
      if (!client.isReady()) return;

      for (const [, guild] of client.guilds.cache) {
        const notifyChannel = guild.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
        if (!notifyChannel || !notifyChannel.isTextBased()) continue;

        // 直近を少し多めに取得（必要なら100にしてOK）
        const messages = await notifyChannel.messages.fetch({ limit: 100 });
        const mine = messages.filter((m) => m.author?.id === client.user.id && typeof m.content === 'string');

        // --- 1) 終了画像：最新1件だけ残して古いのは削除 ---
        const endMsgs = mine
          .filter((m) => m.content.startsWith(TAG_END_IMG) && m.content.includes(VC_END_IMAGE_URL))
          .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

        for (let i = 1; i < endMsgs.length; i++) {
          await endMsgs[i].delete().catch(() => {});
        }

        // --- 2) 開始系：VCが“今も稼働中”なら残す／空なら削除 ---
        // 開始URL/開始画像をまとめて見て、vc=XXXXX を読んで判断
        const startMsgs = mine.filter((m) => m.content.startsWith(TAG_START_URL) || m.content.startsWith(TAG_START_IMG));

        for (const m of startMsgs.values()) {
          const vcId = extractVcId(m.content); // "vc=123" を抜く
          if (!vcId) continue;

          const vcChannel = guild.channels.cache.get(vcId);
          const active = vcChannel && vcChannel.isVoiceBased && vcChannel.isVoiceBased() && vcChannel.members?.size >= 1;

          // VCが稼働中なら消さない（開始直後に消える問題を防ぐ）
          if (active) continue;

          // VCが存在しない/空なら「残骸」とみなして削除
          await m.delete().catch(() => {});
        }
      }
    } catch (err) {
      console.error('[cleanup job error]', err);
    }
  }, 60 * 1000);
}

function extractVcId(text) {
  // 例: "[VC_START_URL] vc=12345 https://..."
  const match = text.match(/\bvc=(\d{5,30})\b/);
  return match ? match[1] : null;
}
