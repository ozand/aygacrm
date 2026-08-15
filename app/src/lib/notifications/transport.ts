import nodemailer from "nodemailer";

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  const url = process.env.SMTP_URL;
  if (!url) {
    return { ok: false, error: "SMTP_URL is not configured" };
  }
  const from = process.env.SMTP_FROM || "AygaCRM <no-reply@localhost>";

  try {
    const transport = nodemailer.createTransport(url);
    await transport.sendMail({ from, to, subject, text: body });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export async function sendTelegram(
  chatId: string,
  text: string
): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
    const json = await response.json();
    if (!response.ok || !json.ok) {
      return {
        ok: false,
        error: json.description || `Telegram API error (${response.status})`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to send Telegram message",
    };
  }
}

export async function sendToChannel(
  channel: { type: string; content: string },
  subject: string,
  body: string
): Promise<SendResult> {
  if (channel.type === "email") {
    return sendEmail(channel.content, subject, body);
  }
  if (channel.type === "telegram") {
    return sendTelegram(channel.content, `${subject}\n\n${body}`);
  }
  return { ok: false, error: `Unsupported channel type: ${channel.type}` };
}
