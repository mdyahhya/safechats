const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // ── FIX: Handle CORS for Browser Calls ──────────────────────
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers };

  try {
    const { record } = JSON.parse(event.body);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get recipients
    const { data: recipients } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', record.chat_id)
      .neq('user_id', record.sender_id);

    if (!recipients || recipients.length === 0) return { statusCode: 200, headers, body: 'No recipients' };

    // 2. Get subscriptions
    const recipientIds = recipients.map(r => r.user_id);
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds);

    if (!subs || subs.length === 0) return { statusCode: 200, headers, body: 'No subs' };

    // 3. Web Push Config
    webpush.setVapidDetails(
      'mailto:yahyabuilds@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const payload = JSON.stringify({
      title: 'SafeChat',
      body: record.content,
      chatId: record.chat_id
    });

    const promises = subs.map(sub => 
      webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key }
      }, payload).catch(e => console.error('Push Error', e))
    );

    await Promise.all(promises);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: err.message };
  }
};
