import { messagingApi, validateSignature, webhook } from "@line/bot-sdk";
import { logWarning } from "@/lib/logger";

export type LineWebhookEvent = webhook.Event;

function getChannelAccessToken() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");
  }

  return token;
}

export function verifyLineSignature(body: string, signature: string) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    throw new Error("Missing LINE_CHANNEL_SECRET");
  }

  return validateSignature(body, channelSecret, signature);
}

export async function replyLineMessage(replyToken: string, text: string) {
  try {
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: getChannelAccessToken()
    });

    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text
        }
      ]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarning("line-reply-failed", { message });
  }
}
