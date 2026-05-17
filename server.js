// server.js
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  DISCORD_GUILD_ID,
  DISCORD_STAFF_ROLE_ID,
  PORT
} = process.env;

app.post('/api/discord/exchange', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI
    });

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.status(500).json({ error: 'Token exchange failed', details: err });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get user
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const user = await userRes.json();

    // Get member in your guild
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!memberRes.ok) {
      return res.status(403).json({ error: 'Not in guild or cannot fetch member' });
    }

    const member = await memberRes.json();

    const hasRole = Array.isArray(member.roles) &&
      member.roles.includes(DISCORD_STAFF_ROLE_ID);

    if (!hasRole) {
      return res.status(403).json({ error: 'Missing staff role' });
    }

    // At this point, user is staff
    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT || 3000, () => {
  console.log(`Server running on port ${PORT || 3000}`);
});
