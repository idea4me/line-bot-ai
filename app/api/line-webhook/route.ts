import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_REPLY } from "@/constants/prompts";
import { getSupportAnswer } from "@/lib/answer";
import { LineWebhookEvent, replyLineMessage, verifyLineSignature } from "@/lib/line";
import { logConversation, logError, logWarning } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-line-signature") ?? "";
  const body = await request.text();

  try {
    if (!verifyLineSignature(body, signature)) {
      logWarning("invalid-line-signature", {
        ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown",
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch (error) {
    logError("line-signature-config", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let payload: { events?: LineWebhookEvent[] };

  try {
    payload = JSON.parse(body) as { events?: LineWebhookEvent[] };
  } catch (error) {
    logError("line-webhook-json", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await Promise.all(
    (payload.events ?? []).map(async (event) => {
      if (event.type !== "message" || event.message.type !== "text" || !event.replyToken) {
        return;
      }

      try {
        const question = event.message.text;
        const result = await getSupportAnswer(question);

        const replyOk = await replyLineMessage(event.replyToken, result.answer);

        logConversation({
          timestamp: new Date().toISOString(),
          userId: event.source?.userId,
          question,
          answer: result.answer,
          finishReason: result.finishReason,
          tokenUsage: result.tokenUsage,
          sourceUsed: result.sourceUsed,
          replyOk
        });
      } catch (error) {
        logError("line-event-processing", error);
        await replyLineMessage(event.replyToken, DEFAULT_REPLY);
      }
    })
  );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "line-webhook",
    env: {
      LINE_CHANNEL_ACCESS_TOKEN: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      LINE_CHANNEL_SECRET: Boolean(process.env.LINE_CHANNEL_SECRET),
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      SHEET_CSV_URL: Boolean(process.env.SHEET_CSV_URL)
    }
  });
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
