const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
app.use(express.json());

// Initialize OAuth2 client using environment variables
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI || "https://shayanai-backend.onrender.com/oauth2callback" // fallback
);

// Step 1: Generate authorization URL
app.get('/auth', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  });
  res.send(`Authorize here: <a href="${authUrl}">Click here to authorize</a>`);
});

// Step 2: OAuth callback
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code missing.');
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save refresh token securely (ignored in Git)
    fs.writeFileSync('token.json', JSON.stringify(tokens));
    console.log('✅ Tokens saved successfully.');

    res.send('Authorization successful! You can close this tab.');
  } catch (error) {
    console.error('❌ OAuth callback error:', error.response?.data || error.message);
    res.status(500).send('Authorization failed.');
  }
});

// Step 3: Webhook to create Google Calendar event
app.post('/book', async (req, res) => {
  const { name, email, date, time } = req.body;

  if (!name || !email || !date || !time) {
    return res.status(400).send('Missing required fields: name, email, date, or time.');
  }

  try {
    const tokens = JSON.parse(fs.readFileSync('token.json'));
    oAuth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60000); // 30 minutes

    const event = {
      summary: `Meeting with ${name}`,
      description: `Booking via ShayanAI`,
      start: { dateTime: startDateTime.toISOString() },
      end: { dateTime: endDateTime.toISOString() },
      attendees: [{ email }],
    };

    await calendar.events.insert({ calendarId: 'primary', resource: event });
    console.log(`✅ Event created for ${name} on ${date} at ${time}`);
    res.send('Booking confirmed!');
  } catch (error) {
    console.error('❌ Error inserting calendar event:', error.response?.data || error.message);
    res.status(500).send('Error booking the meeting.');
  }
});

// Use dynamic port for Render or fallback to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
