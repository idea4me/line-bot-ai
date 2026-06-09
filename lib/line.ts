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

function getErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const details = Object.fromEntries(
    Object.entries(error as Error & Record<string, unknown>).filter(([, value]) => {
      const valueType = typeof value;
      return valueType === "string" || valueType === "number" || valueType === "boolean";
    })
  );

  return {
    name: error.name,
    message: error.message,
    ...details
  };
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

    return true;
  } catch (error) {
    logWarning("line-reply-failed", getErrorDetails(error));
    return false;
  }
}
