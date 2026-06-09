import { NextRequest, NextResponse } from "next/server";
import { messagingApi, validateSignature, webhook } from "@line/bot-sdk";
import { getAnswer } from "@/services/answer-service";
import { logConversation, logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;

function getLineClient() {
  if (!channelAccessToken) {
    throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");
  }

  return new messagingApi.MessagingApiClient({
    channelAccessToken
  });
}

export async function POST(request: NextRequest) {
  if (!channelSecret) {
    return NextResponse.json({ error: "Missing LINE_CHANNEL_SECRET" }, { status: 500 });
  }

  const signature = request.headers.get("x-line-signature") ?? "";
  const body = await request.text();

  if (!validateSignature(body, channelSecret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { events?: webhook.Event[] };
  const client = getLineClient();

  await Promise.all(
    (payload.events ?? []).map(async (event) => {
      if (event.type !== "message" || event.message.type !== "text") {
        return;
      }

      if (!event.replyToken) {
        return;
      }

      const question = event.message.text;
      const result = await getAnswer(question);

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: result.answer
          }
        ]
      });

      logConversation({
        timestamp: new Date().toISOString(),
        userId: event.source?.userId,
        question,
        answer: result.answer,
        finishReason: result.finishReason,
        tokenUsage: result.tokenUsage,
        sourceUsed: result.sourceUsed
      });
    })
  );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" });
}

export async function OPTIONS() {
  try {
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("line-webhook-options", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
