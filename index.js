// index.js
const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const { startYouTubeNotifier } = require('./youtube-notifier');

const app = express();
const PORT = process.env.PORT || 4000;
const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();

// ===== 設定 =====

// VC通知を投げるテキストチャンネルID
const VC_NOTIFY_CHANNEL_ID = '951896358590251028';

// VC開始時に貼る画像URL（あなたのURLに置き換えてください）
const VC_START_IMAGE_URL = 'https://cdn.discordapp.com/attachments/951896358590251028/1458271291814449254/Gemini_Generated_Image_7mqyub7mqyub7mqy.png?ex=695f0879&is=695db6f9&hm=767d502bbcfee33a17b5908fd2efe50c751c2c4c6f5e2c8ada3efbd746099239&';

// VC終了時に貼る画像URL（既存）
const VC_END_IMAGE_URL =
  'https://cdn.discordapp.com/attachments/951896358590251028/1458264783919775774/Gemini_Generated_Image_help4ahelp4ahelp.png?ex=695f0269&is=695db0e9&hm=4dc67c480c7f03da89eb5ce663339b09ca5e2723dc2721ca8dff553cecb1af3e&';

// YouTubeの配信・動画通知を貼るテキストチャンネルID（別のチャンネルにしたい場合はここを変更）
const YOUTUBE_NOTIFY_CHANNEL_ID = '926043729243033611';

// ==== 1. Webサーバーを最優先で起動 ====

// RenderのHealth Check用
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// メインアクセス用
app.get('/', (req, res) => {
  res.status(200).send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`✅ Web Server running on port ${PORT}`);
});

// ==== 2. Botの準備 ====
if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN がありません');
  process.exit(1);
}

// VC開始時に送った「招待URL」と「開始画像」を覚えておく（VCごとに管理）
const vcAlertMap = new Map(); // key: `${guildId}:${vcChannelId}` -> { urlMsg, startImgMsg }

// VC終了時の画像は「最新1件だけ残す」ため、ギルドごとに覚えておく
const vcEndImageMap = new Map(); // key: guildId -> Message

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates, // VC検知に必要
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Discordログイン完了: ${c.user.tag}`);
  c.user.setActivity('性的な人生0.95', { type: 0 });

  // YouTubeの配信開始・動画投稿を自動でお知らせ
  startYouTubeNotifier(client, {
    discordChannelId: YOUTUBE_NOTIFY_CHANNEL_ID,
  });
});

// テキスト反応
client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;

  if (message.content === 'せいさんは') {
    message.reply('超絶イケメン美男子').catch(console.error);
  }
  if (message.content === 'せいは') {
    message.reply('ちんぱん').catch(console.error);
  }
});

// ==== VC検知（開始・終了） ====
// 仕様：
// ・VCに「誰もいない」状態から、最初の1人が入った瞬間に通知（招待URL＋開始画像）
// ・VCが「0人」になった瞬間に、開始時の2メッセージを削除し、終了画像を送信
// ・終了画像は「最新1件だけ残す」（古い終了画像は削除）
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const notifyChannel = guild.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
    if (!notifyChannel) return;

    const oldCh = oldState.channel; // 移動/退出前
    const newCh = newState.channel; // 移動/入室後

    // ===== VC開始（最初の1人が入った）=====
    if (
      newCh &&
      (!oldCh || oldCh.id !== newCh.id) &&
      newCh.members.size === 1
    ) {
      const key = `${guild.id}:${newCh.id}`;

      // 招待URL
      const urlMsg = await notifyChannel.send(newCh.url);
      // 開始画像
      const startImgMsg = await notifyChannel.send(VC_START_IMAGE_URL);

      // 後で削除できるように両方覚える
      vcAlertMap.set(key, { urlMsg, startImgMsg });
    }

    // ===== VC終了（0人になった）=====
    if (
      oldCh &&
      (!newCh || oldCh.id !== newCh.id) &&
      oldCh.members.size === 0
    ) {
      const key = `${guild.id}:${oldCh.id}`;

      // 開始時に送った「招待URL」と「開始画像」を両方削除
      const startBundle = vcAlertMap.get(key);
      if (startBundle) {
        const { urlMsg, startImgMsg } = startBundle;
        if (urlMsg) await urlMsg.delete().catch(() => {});
        if (startImgMsg) await startImgMsg.delete().catch(() => {});
        vcAlertMap.delete(key);
      }

      // 過去の終了画像は削除（最新1件だけ残す）
      const oldEndImageMsg = vcEndImageMap.get(guild.id);
      if (oldEndImageMsg) {
        await oldEndImageMsg.delete().catch(() => {});
      }

      // 新しい終了画像を送信して保存
      const endImageMsg = await notifyChannel.send(VC_END_IMAGE_URL);
      vcEndImageMap.set(guild.id, endImageMsg);
    }
  } catch (err) {
    console.error('[voiceStateUpdate error]', err);
  }
});

client.on('error', (err) => console.error('[CLIENT ERROR]', err));

// ==== 3. ログイン実行 ====
client.login(TOKEN).catch((err) => {
  console.error('❌ Discordログイン失敗:', err);
  process.exit(1);
});

// 念のため：グローバルなエラーハンドラ
process.on('unhandledRejection', (reason) => {
  console.error('🔥 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err);
});

