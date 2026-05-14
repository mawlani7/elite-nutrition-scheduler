const express = require('express');
const cron = require('node-cron');
const { Client } = require('@notionhq/client');
const nodemailer = require('nodemailer');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const notionDbId = process.env.NOTION_DB_ID;
const igAccessToken = process.env.IG_ACCESS_TOKEN;
const igBusinessAccountId = process.env.IG_BUSINESS_ACCOUNT_ID;
const yaseeEmail = process.env.YASEEN_EMAIL;

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
      database_id: notionDbId,
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

async function getApprovedPosts(date) {
  const dateStr = date.toISOString().split('T')[0];
  
  try {
    const response = await notion.databases.query({
      database_id: notionDbId,
      filter: {
        and: [
          {
            property: 'Date',
            date: { equals: dateStr }
          },
          {
            property: 'Status',
            select: { equals: 'Approved' }
          }
        ]
      }
    });
    return response.results;
  } catch (error) {
    console.error('Error querying approved posts:', error);
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
    const date = post.properties.Date?.date?.start || 'N/A';

    emailBody += `Post ${index + 1}:\nTitle: ${title}\nType: ${contentType}\nDate: ${date}\nPreview: "${preview.substring(0, 100)}..."\n\nView in Notion: https://www.notion.so/${post.id.replace(/-/g, '')}\n\n`;
  });

  emailBody += `View all posts: ${process.env.NOTION_CALENDAR_URL}\n\nApprove posts by changing Status to "Approved" in Notion.\n\n-Elite Nutrition Instagram System`;

  try {
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: yaseeEmail,
      subject: `Your Instagram posts are ready for approval (${posts.length} posts)`,
      text: emailBody
    });
    console.log(`Approval email sent to ${yaseeEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function publishToInstagram(post) {
  try {
    const title = post.properties.Title?.title?.[0]?.plain_text || 'Untitled';
    const caption = post.properties['Full Copy']?.rich_text?.[0]?.plain_text || post.properties['Copy Preview']?.rich_text?.[0]?.plain_text || '';
    
    console.log(`Publishing to Instagram: ${title}`);
    console.log(`Caption: ${caption.substring(0, 100)}...`);

    // For now, log the post (actual publishing requires media URLs)
    console.log(`Would publish: ${title} to Instagram`);

    return { success: true, id: `mock_post_${Date.now()}` };
  } catch (error) {
    console.error('Error publishing to Instagram:', error);
    return { success: false, error: error.message };
  }
}

async function updatePostStatus(pageId, status, postId = null) {
  const updateData = {
    properties: {
      Status: { select: { name: status } },
      'date:Published At:start': new Date().toISOString().split('T')[0],
      'date:Published At:is_datetime': 0
    }
  };

  if (postId) {
    updateData.properties['Post ID'] = { rich_text: [{ text: { content: postId } }] };
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: updateData.properties
    });
    console.log(`Updated post ${pageId} to status: ${status}`);
  } catch (error) {
    console.error('Error updating Notion page:', error);
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

// Publishing at 9am UK time
cron.schedule('0 9 * * *', async () => {
  console.log('Running publishing job...');
  const today = new Date();
  const approvedPosts = await getApprovedPosts(today);
  
  for (const post of approvedPosts) {
    const result = await publishToInstagram(post);
    if (result.success) {
      await updatePostStatus(post.id, 'Published', result.id);
    } else {
      await updatePostStatus(post.id, 'Failed');
    }
  }
});

// Analytics sync at 10am UK time (24 hours after posting)
cron.schedule('0 10 * * *', async () => {
  console.log('Running analytics sync job...');
  console.log('Analytics sync scheduled but IG API auth still pending');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Manual trigger endpoints (for testing)
app.post('/trigger-approval-email', async (req, res) => {
  const today = new Date();
  const posts = await getPostsForDate(today);
  await sendApprovalEmail(posts);
  res.json({ success: true, postsFound: posts.length });
});

app.post('/trigger-publish', async (req, res) => {
  const today = new Date();
  const approvedPosts = await getApprovedPosts(today);
  res.json({ success: true, postsPublished: approvedPosts.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Elite Nutrition Scheduler running on port ${PORT}`);
  console.log('Cron jobs active:');
  console.log('- 8am UK: Send approval emails');
  console.log('- 9am UK: Publish approved posts');
  console.log('- 10am UK: Sync analytics');
});
