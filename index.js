// index.js
const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 4000;
const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();

// VC通知を投げるテキストチャンネルID（2個目コードのIDをそのまま採用）
const VC_NOTIFY_CHANNEL_ID = '951896358590251028';

// ==== 1. Webサーバーを最優先で起動 ====

// RenderのHealth Check用 (設定が /healthz なのでここに合わせます)
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

// VC開始時に送った「通知メッセージ」を覚えておく（VCごとに管理）
const vcAlertMap = new Map(); // key: `${guildId}:${vcChannelId}` -> Message

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,

    // ★ VC検知に必要
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Discordログイン完了: ${c.user.tag}`);
  c.user.setActivity('性的な人生0.5', { type: 0 });
});

// テキスト反応
client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;

  if (message.content === 'ping') {
    message.reply('pong').catch(console.error);
  }
  if (message.content === 'せいは') {
    message.reply('ちんぱん').catch(console.error);
  }
});

// ==== 追加: VC検知（開始・終了） ====
// 仕様：
// ・VCに「誰もいない」状態から、最初の1人が入った瞬間に通知（VC URL送信）
// ・VCが「0人」になった瞬間に、通知メッセージを削除して「お疲れ様でした」を送信
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const notifyChannel = guild.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
    if (!notifyChannel) return;

    const oldCh = oldState.channel; // 移動/退出前
    const newCh = newState.channel; // 移動/入室後

    // --- 入室/移動先で「最初の1人」になったら通知 ---
    // 入室: oldChなし -> newChあり
    // 移動: oldChあり -> newChあり（別チャンネル）
    if (newCh && (!oldCh || oldCh.id !== newCh.id) && newCh.members.size === 1) {
      const key = `${guild.id}:${newCh.id}`;
      const alertMsg = await notifyChannel.send(`${newCh.url}`);
      vcAlertMap.set(key, alertMsg);
    }

    // --- 退出/移動元が「0人」になったら通知削除＆お疲れ様 ---
    // 退出: oldChあり -> newChなし
    // 移動: oldChあり -> newChあり（別チャンネル）
    if (oldCh && (!newCh || oldCh.id !== newCh.id) && oldCh.members.size === 0) {
      const key = `${guild.id}:${oldCh.id}`;
      const alertMsg = vcAlertMap.get(key);

      if (alertMsg) {
        await alertMsg.delete().catch(() => {});
        vcAlertMap.delete(key);
      }

      await notifyChannel.send('https://cdn.discordapp.com/attachments/951896358590251028/1458264783919775774/Gemini_Generated_Image_help4ahelp4ahelp.png?ex=695f0269&is=695db0e9&hm=4dc67c480c7f03da89eb5ce663339b09ca5e2723dc2721ca8dff553cecb1af3e&').catch(() => {});
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