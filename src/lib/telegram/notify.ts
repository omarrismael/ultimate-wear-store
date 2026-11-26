import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, OrderItem } from "@/types";
import { INSTAPAY_NUMBER, VODAFONE_CASH_NUMBER } from "@/lib/constants";
import { createOptionalServiceClient } from "@/lib/supabase/service";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface NotifyTelegramResult {
  sent: boolean;
  photoSent?: boolean;
  statusCode?: number;
  error?: string;
}

export async function sendOrderTelegramNotification(
  supabase: SupabaseClient,
  order: Order,
  items: OrderItem[],
  customerName?: string | null
): Promise<NotifyTelegramResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    const missing = [
      !botToken ? "TELEGRAM_BOT_TOKEN" : null,
      !chatId ? "TELEGRAM_CHAT_ID" : null,
    ].filter(Boolean);
    const errMsg = `Telegram credentials missing: ${missing.join(", ")}`;
    console.error(`[Telegram] ${errMsg} (order=${order.order_code})`);
    return { sent: false, statusCode: 500, error: errMsg };
  }

  const storageClient = createOptionalServiceClient() ?? supabase;

  const targetAccount =
    order.payment_method === "vodafone_cash"
      ? VODAFONE_CASH_NUMBER
      : INSTAPAY_NUMBER;
  const methodLabel =
    order.payment_method === "vodafone_cash" ? "Vodafone Cash" : "InstaPay";

  const itemsLines = items
    .map(
      (item, idx) =>
        `${idx + 1}. <b>${escapeHtml(item.product_title_en)}</b> (${escapeHtml(
          item.size
        )}${
          item.color_name ? ` · ${escapeHtml(item.color_name)}` : ""
        }) × ${item.quantity} — ${item.unit_price * item.quantity} EGP`
    )
    .join("\n");

  let receiptLink = "Receipt uploaded to private storage (payment-receipts)";
  try {
    const { data: signedData, error: signErr } = await storageClient.storage
      .from("payment-receipts")
      .createSignedUrl(order.receipt_path, 60 * 60 * 24);

    if (signErr) {
      console.warn(
        `[Telegram] Could not create signed receipt URL for ${order.order_code}:`,
        signErr.message
      );
    } else if (signedData?.signedUrl) {
      receiptLink = `<a href="${escapeHtml(signedData.signedUrl)}">View Transfer Receipt (24h)</a>`;
    }
  } catch (err) {
    console.warn(`[Telegram] Signed URL exception for ${order.order_code}:`, err);
  }

  const messageHtml = [
    `<b>🖤 ULTIMATE — NEW ORDER RECEIVED</b>`,
    ``,
    `<b>Order ID:</b> <code>${escapeHtml(order.order_code)}</code>`,
    `<b>Status:</b> ${escapeHtml(order.status)}`,
    customerName ? `<b>Customer Name:</b> ${escapeHtml(customerName)}` : null,
    `<b>Customer Email:</b> ${escapeHtml(order.customer_email)}`,
    `<b>Phone / WhatsApp:</b> <code>${escapeHtml(order.customer_phone)}</code>`,
    `<b>City:</b> ${escapeHtml(order.city)}`,
    `<b>Address:</b> ${escapeHtml(order.shipping_address)}`,
    ``,
    `<b>Payment:</b> ${methodLabel} (to <code>${escapeHtml(targetAccount)}</code>)`,
    order.sender_phone
      ? `<b>Sender Phone:</b> <code>${escapeHtml(order.sender_phone)}</code>`
      : null,
    order.transaction_ref
      ? `<b>Tx Reference:</b> <code>${escapeHtml(order.transaction_ref)}</code>`
      : null,
    ``,
    `<b>Items:</b>`,
    itemsLines,
    ``,
    `<b>Total Amount:</b> <b>${order.total_amount} EGP</b>`,
    order.notes ? `<b>Notes:</b> ${escapeHtml(order.notes)}` : null,
    `<b>Receipt:</b> ${receiptLink}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  let photoSent = false;
  let photoFailureReason: string | undefined;

  // 1. Download receipt image from private bucket & dispatch via sendPhoto
  try {
    const { data: blobData, error: dlErr } = await storageClient.storage
      .from("payment-receipts")
      .download(order.receipt_path);

    if (dlErr || !blobData) {
      photoFailureReason = dlErr?.message || "Empty receipt blob";
      console.warn(
        `[Telegram] Failed to download receipt '${order.receipt_path}' for ${order.order_code}:`,
        photoFailureReason
      );
    } else {
      const ext = order.receipt_path.split(".").pop()?.toLowerCase() || "jpg";
      const useFullCaption = messageHtml.length <= 1024;
      const caption = useFullCaption
        ? messageHtml
        : `<b>🖤 ULTIMATE — Receipt for ${escapeHtml(order.order_code)}</b>\nTotal: <b>${order.total_amount} EGP</b>`;

      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("parse_mode", "HTML");
      form.append("caption", caption);
      form.append("photo", blobData, `receipt-${order.order_code}.${ext}`);

      const photoRes = await fetch(
        `https://api.telegram.org/bot${botToken}/sendPhoto`,
        {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(10000),
        }
      );

      if (photoRes.ok) {
        photoSent = true;
        if (useFullCaption) {
          return { sent: true, photoSent: true, statusCode: photoRes.status };
        }
      } else {
        const errText = await photoRes.text().catch(() => "");
        photoFailureReason = `sendPhoto HTTP ${photoRes.status}: ${errText}`;
        console.error(
          `[Telegram] sendPhoto rejected for ${order.order_code}:`,
          photoFailureReason
        );

        // Fallback to sendDocument using the same downloaded receipt binary
        try {
          const docForm = new FormData();
          docForm.append("chat_id", chatId);
          docForm.append("parse_mode", "HTML");
          docForm.append("caption", caption);
          docForm.append("document", blobData, `receipt-${order.order_code}.${ext}`);

          const docRes = await fetch(
            `https://api.telegram.org/bot${botToken}/sendDocument`,
            {
              method: "POST",
              body: docForm,
              signal: AbortSignal.timeout(10000),
            }
          );

          if (docRes.ok) {
            photoSent = true;
            if (useFullCaption) {
              return { sent: true, photoSent: true, statusCode: docRes.status };
            }
          } else {
            const docErrText = await docRes.text().catch(() => "");
            photoFailureReason = `${photoFailureReason}; sendDocument HTTP ${docRes.status}: ${docErrText}`;
            console.error(
              `[Telegram] sendDocument fallback rejected for ${order.order_code}:`,
              docErrText
            );
          }
        } catch (docErr) {
          const docErrMsg =
            docErr instanceof Error ? docErr.message : "sendDocument exception";
          photoFailureReason = `${photoFailureReason}; ${docErrMsg}`;
          console.error(
            `[Telegram] sendDocument exception for ${order.order_code}:`,
            docErrMsg
          );
        }
      }
    }
  } catch (err) {
    photoFailureReason =
      err instanceof Error ? err.message : "sendPhoto request failed";
    console.error(
      `[Telegram] sendPhoto exception for ${order.order_code}:`,
      photoFailureReason
    );
  }

  // 2. Send full HTML message (either because caption > 1024 chars, or fallback after photo issue)
  try {
    const msgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageHtml,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!msgRes.ok) {
      const text = await msgRes.text().catch(() => "");
      const combinedErr = photoFailureReason
        ? `sendMessage HTTP ${msgRes.status}: ${text} (prior sendPhoto error: ${photoFailureReason})`
        : `sendMessage HTTP ${msgRes.status}: ${text}`;
      console.error(
        `[Telegram] sendMessage rejected for ${order.order_code}:`,
        combinedErr
      );
      return {
        sent: photoSent,
        photoSent,
        statusCode: msgRes.status,
        error: combinedErr,
      };
    }

    return {
      sent: true,
      photoSent,
      statusCode: msgRes.status,
      ...(photoFailureReason && !photoSent
        ? { error: `Text sent; photo skipped (${photoFailureReason})` }
        : {}),
    };
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Telegram dispatch failed";
    console.error(`[Telegram] sendMessage exception for ${order.order_code}:`, errMsg);
    return {
      sent: photoSent,
      photoSent,
      statusCode: 502,
      error: photoFailureReason ? `${errMsg} (${photoFailureReason})` : errMsg,
    };
  }
}
