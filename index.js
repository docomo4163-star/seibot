const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');
const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const port = process.env.PORT || 4000 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent, // メッセージの内容を受け取るためのインテント
    ],
});
const alert_map = new Map()
client.once('ready', () => {
    console.log('ボットがオンラインです！');
});

client.on('messageCreate', message => {
    if (message.content === 'せいは') {
        message.channel.send('ちんぱん');
    }
    if (message.content === 'ちんぱんは') {
        message.channel.send('せい');
    }
    if (message.content === 'チンパンは') {
        message.channel.send('せい');
    }
    if (message.content === 'チンパンジーは') {
        message.channel.send('せい');
    }
    if (message.content === 'ちんぱんじーは') {
        message.channel.send('せい');
    }
});



client.on('voiceStateUpdate', async(oldState, newState) => {
    // === VCに入った最初の1人の処理 ===
  if (
    newState.channel &&
    !oldState.channel &&
    newState.channel.members.size === 1
  ) {
    // 新しい状態が通話に参加した場合
        const channel = newState.guild.channels.cache.get("951896358590251028");
        // 通話に参加したメンバーに通知
        const alert =await channel.send(`${newState.channel.url}`);
        alert_map.set(channel,alert)
    }
//　通話の人が０人になった時　//
if (oldState.channel &&
     oldState.channel.members.size === 0   
){
    const channel = oldState.guild.channels.cache.get("951896358590251028");
    const alert = alert_map.has(channel) ? alert_map.get(channel) : null
    if(alert){  
        alert.delete().catch((e)=>{})
         channel.send('お疲れ様でした')
    }
    
}
});

// ==== Render 用 HTTP サーバ ====
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server is listening on port ${port}`);
});

// ==== Discord にログイン ====
console.log('DISCORD_BOT_TOKEN が設定されているか:', TOKEN.length > 0);

if (!TOKEN) {
  console.error('DISCORD_BOT_TOKEN が設定されていません');
} else {
  console.log('Discord ログインを試みます…');
  client.login(TOKEN)
    .then(() => {
      console.log('Discord ログイン成功');
    })
    .catch(err => {
      console.error('Discord ログインに失敗しました:', err);
    });
}
