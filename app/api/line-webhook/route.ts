import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_REPLY } from "@/constants/prompts";
import { getSupportAnswer } from "@/lib/answer";
import { LineWebhookEvent, replyLineMessage, verifyLineSignature } from "@/lib/line";
import { logError, logInfo, logWarning, logConversation } from "@/lib/logger";
import { getFaqCsvContent } from "@/lib/faq";
import { generateGeminiAnswer } from "@/lib/gemini";

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

  const events = payload.events ?? [];
  logInfo("line-webhook-received", {
    eventCount: events.length,
    eventTypes: events.map((event) => event.type),
    modes: events.map((event) => event.mode),
    messageTypes: events.map((event) => (event.type === "message" ? event.message.type : null)),
    hasReplyTokens: events.map((event) => ("replyToken" in event ? Boolean(event.replyToken) : false))
  });

  if (events.length === 0) {
    logInfo("line-webhook-empty-events");
  }

  await Promise.all(
    events.map(async (event) => {
      if (event.type !== "message") {
        logInfo("line-webhook-event-skipped", { reason: "not-message", eventType: event.type });
        return;
      }

      if (event.message.type !== "text") {
        logInfo("line-webhook-event-skipped", { reason: "not-text", messageType: event.message.type });
        return;
      }

      if (!event.replyToken) {
        logWarning("line-webhook-event-skipped", {
          reason: "missing-reply-token",
          mode: event.mode,
          sourceType: event.source?.type
        });
        return;
      }

      try {
        const question = event.message.text;
        logInfo("line-webhook-text-message", {
          userId: event.source?.userId,
          messageLength: question.length
        });

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
          replyOk,
          defaultReason: result.defaultReason
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
  const testResults: Record<string, any> = {
    env: {
      LINE_CHANNEL_ACCESS_TOKEN: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      LINE_CHANNEL_SECRET: Boolean(process.env.LINE_CHANNEL_SECRET),
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      SHEET_CSV_URL: Boolean(process.env.SHEET_CSV_URL)
    }
  };

  try {
    const sheetCsvUrl = process.env.SHEET_CSV_URL;
    if (sheetCsvUrl) {
      const res = await fetch(sheetCsvUrl, { cache: "no-store" });
      const rawText = await res.text();
      testResults.rawSheet = {
        status: "success",
        statusCode: res.status,
        length: rawText.length,
        sample: rawText.slice(0, 300)
      };
    } else {
      testResults.rawSheet = { status: "error", message: "SHEET_CSV_URL not set" };
    }
  } catch (error: any) {
    testResults.rawSheet = {
      status: "error",
      message: error.message ?? String(error)
    };
  }

  try {
    const csv = await getFaqCsvContent();
    testResults.faqSheet = {
      status: "success",
      length: csv.length,
      sample: csv.slice(0, 150)
    };
  } catch (error: any) {
    testResults.faqSheet = {
      status: "error",
      message: error.message ?? String(error),
      stack: error.stack
    };
  }

  try {
    const geminiTest = await generateGeminiAnswer("Hi");
    testResults.gemini = {
      status: "success",
      response: geminiTest
    };
  } catch (error: any) {
    testResults.gemini = {
      status: "error",
      message: error.message ?? String(error),
      stack: error.stack
    };
  }

  try {
    const testAnswer = await getSupportAnswer("สวัสดี");
    testResults.testBot = {
      status: testAnswer.sourceUsed === "DEFAULT" ? "fallback" : "success",
      result: testAnswer
    };
  } catch (error: any) {
    testResults.testBot = {
      status: "error",
      message: error.message ?? String(error),
      stack: error.stack
    };
  }

  return NextResponse.json({
    ok: true,
    service: "line-webhook",
    ...testResults
  });
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}
