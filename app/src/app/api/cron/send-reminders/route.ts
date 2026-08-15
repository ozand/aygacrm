export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRemindersDueToday } from "@/lib/actions/reminders";

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// It checks for reminders due today and sends notifications

// Optional: Add a secret key for security
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify the request is from a trusted source
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const remindersDue = await getRemindersDueToday();

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      details: [] as Array<{
        contactName: string;
        eventLabel: string;
        channelType: string;
        status: "sent" | "failed";
        error?: string;
      }>,
    };

    for (const reminderInfo of remindersDue) {
      results.processed++;

      for (const user of reminderInfo.users) {
        for (const channel of user.channels) {
          try {
            // Build notification content
            const subject = `Reminder: ${reminderInfo.contactName}'s ${reminderInfo.eventLabel}`;
            const body = buildNotificationBody(reminderInfo);

            // Send notification based on channel type
            if (channel.type === "email") {
              await sendEmailNotification(channel.content, subject, body);
            } else if (channel.type === "telegram") {
              await sendTelegramNotification(channel.content, subject, body);
            }

            // Record the sent notification
            await db.userNotificationSent.create({
              data: {
                channelId: channel.id,
                subject,
                body,
              },
            });

            results.sent++;
            results.details.push({
              contactName: reminderInfo.contactName,
              eventLabel: reminderInfo.eventLabel,
              channelType: channel.type,
              status: "sent",
            });
          } catch (error) {
            results.failed++;
            results.details.push({
              contactName: reminderInfo.contactName,
              eventLabel: reminderInfo.eventLabel,
              channelType: channel.type,
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
            });

            // Increment failed attempts on the channel
            await db.userNotificationChannel.update({
              where: { id: channel.id },
              data: { failedAttempts: { increment: 1 } },
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function buildNotificationBody(reminderInfo: {
  contactName: string;
  eventLabel: string;
  eventDate: Date;
}): string {
  const formattedDate = reminderInfo.eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
Hello!

This is a reminder that ${reminderInfo.contactName}'s ${reminderInfo.eventLabel} is coming up on ${formattedDate}.

Don't forget to reach out!

Best,
AygaCRM
`.trim();
}

async function sendEmailNotification(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  // TODO: Implement actual email sending using nodemailer or similar
  // For now, just log the notification
  console.log(`[EMAIL] To: ${to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body: ${body}`);

  // Example with nodemailer:
  // const transporter = nodemailer.createTransport({...});
  // await transporter.sendMail({ to, subject, text: body });
}

async function sendTelegramNotification(
  chatId: string,
  subject: string,
  body: string
): Promise<void> {
  // TODO: Implement actual Telegram sending using Telegram Bot API
  // For now, just log the notification
  console.log(`[TELEGRAM] Chat ID: ${chatId}`);
  console.log(`[TELEGRAM] Message: ${subject}\n\n${body}`);

  // Example with Telegram Bot API:
  // const botToken = process.env.TELEGRAM_BOT_TOKEN;
  // await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ chat_id: chatId, text: `${subject}\n\n${body}` }),
  // });
}
