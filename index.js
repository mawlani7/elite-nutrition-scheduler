const express = require('express');
const cron = require('node-cron');
const { Client } = require('@notionhq/client');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function getPostsForDate(date) {
  const dateStr = date.toISOString().split('T')[0];
  
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DB_ID,
      filter: {
        property: 'Date',
        date: { equals: dateStr }
      }
    });
    return response.results;
  } catch (error) {
    console.error('Error querying Notion:', error);
    return [];
  }
}

async function sendApprovalEmail(posts) {
  if (posts.length === 0) return;

  let emailBody = `Good morning Yaseen,\n\nYou have ${posts.length} posts ready for approval today:\n\n`;

  posts.forEach((post, index) => {
    const title = post.properties.Title?.title?.[0]?.plain_text || 'Untitled';
    const contentType = post.properties['Content Type']?.select?.name || 'N/A';
    const preview = post.properties['Copy Preview']?.rich_text?.[0]?.plain_text || 'No preview';

    emailBody += `Post ${index + 1}:\nTitle: ${title}\nType: ${contentType}\nPreview: "${preview.substring(0, 100)}..."\n\n`;
  });

  emailBody += `View all posts: ${process.env.NOTION_CALENDAR_URL}\n\nApprove posts by changing Status to "Approved" in Notion.\n\n-Elite Nutrition Instagram System`;

  try {
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.YASEEN_EMAIL,
      subject: `Your Instagram posts are ready for approval (${posts.length} posts)`,
      text: emailBody
    });
    console.log(`Approval email sent to ${process.env.YASEEN_EMAIL}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Daily approval email at 8am UK time
cron.schedule('0 8 * * *', async () => {
  console.log('Running daily approval email job...');
  const today = new Date();
  const posts = await getPostsForDate(today);
  if (posts.length > 0) {
    await sendApprovalEmail(posts);
  }
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'Elite Nutrition Instagram Scheduler is running',
    timestamp: new Date().toISOString(),
    notion_db: process.env.NOTION_DB_ID
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/trigger-approval', async (req, res) => {
  const today = new Date();
  const posts = await getPostsForDate(today);
  await sendApprovalEmail(posts);
  res.json({ success: true, posts_found: posts.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Elite Nutrition Scheduler running on port ${PORT}`);
});

module.exports = app;
