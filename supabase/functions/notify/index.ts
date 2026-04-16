// supabase/functions/notify/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import WebPush from "https://esm.sh/web-push"

serve(async (req) => {
  try {
    const { record } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: recipients } = await supabase
      .from('chat_members')
      .select('user_id')
      .eq('chat_id', record.chat_id)
      .neq('user_id', record.sender_id);

    if (!recipients || recipients.length === 0) return new Response('No recipients');

    const recipientIds = recipients.map(r => r.user_id);
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds);

    if (!subs || subs.length === 0) return new Response('No subs');

    // READ FROM DASHBOARD SECRETS
    WebPush.setVapidDetails(
      "mailto:yahyabuilds@gmail.com",
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    );

    const notifications = subs.map(sub => {
      const payload = JSON.stringify({
        title: 'SafeChat',
        body: record.content,
        chatId: record.chat_id
      });
      return WebPush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key }
      }, payload);
    });

    await Promise.allSettled(notifications);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
