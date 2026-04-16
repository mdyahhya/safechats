// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import WebPush from "https://esm.sh/web-push"

// YOUR SECURE KEYS (Directly Integrated)
const VAPID_PUBLIC_KEY = "BELCT0Uy_yvenQQKIYhnICRbfpaLvbM5qK75aIPasNZR7f8WRKE94op6WyyfWleRpDNuoGGnUMTkXX2P7mgoBbU";
const VAPID_PRIVATE_KEY = "np8pL5JxiQUO4sxB2yNWXCEWPotiDHY9zhZg9m32MLU";
const VAPID_SUBJECT = "mailto:yahyabuilds@gmail.com";

serve(async (req) => {
  try {
    const { record } = await req.json(); // The new message record from Webhook

    // Supabase automatically provides these env vars to Edge Functions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get other members in the chat (except the sender)
    const { data: recipients, error: recErr } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', record.chat_id)
      .neq('user_id', record.sender_id);

    if (!recipients || recipients.length === 0) {
        return new Response('No other members to notify');
    }

    // 2. Get their push subscriptions
    const recipientIds = recipients.map(r => r.user_id);
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds);

    if (!subs || subs.length === 0) {
        return new Response('No active push subscriptions found');
    }

    // 3. Configure WebPush
    WebPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // 4. Send the messages to all devices
    const notifications = subs.map(sub => {
      const payload = JSON.stringify({
        title: 'SafeChat',
        body: record.content,
        chatId: record.chat_id
      });

      return WebPush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key }
      }, payload).catch(err => {
          console.error('Push failed for endpoint:', sub.endpoint, err);
      });
    });

    await Promise.allSettled(notifications);
    return new Response(JSON.stringify({ success: true }), { 
        headers: { 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
    });
  }
});
