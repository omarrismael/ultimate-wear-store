import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/security/rate-limit";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

function detectImageType(
  bytes: Uint8Array
): { ext: "jpg" | "png" | "webp"; contentType: string } | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  // WEBP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { errorCode: "UNAUTHORIZED", error: "Please sign in before uploading a receipt." },
        { status: 401 }
      );
    }

    const ip = getClientIp(request);
    const limit = checkRateLimit(
      `receipt:upload:${user.id}:${ip}`,
      RATE_LIMITS.ORDER_NOTIFY.limit,
      RATE_LIMITS.ORDER_NOTIFY.windowMs,
      RATE_LIMITS.ORDER_NOTIFY.blockMs
    );
    if (!limit.allowed) {
      return NextResponse.json(
        {
          errorCode: "RATE_LIMITED",
          error: `Too many upload attempts. Retry in ${limit.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { errorCode: "MISSING_FILE", error: "No image file provided." },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) {
      return NextResponse.json(
        { errorCode: "TOO_LARGE", error: "Receipt image must be 5MB or smaller." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detected = detectImageType(bytes);

    if (!detected) {
      return NextResponse.json(
        {
          errorCode: "INVALID_TYPE",
          error: "Receipt must be a valid PNG, JPG, or WEBP image.",
        },
        { status: 400 }
      );
    }

    const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${detected.ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("payment-receipts")
      .upload(filePath, bytes, {
        contentType: detected.contentType,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { errorCode: "UPLOAD_FAILED", error: uploadErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ receiptPath: filePath }, { status: 201 });
  } catch {
    return NextResponse.json(
      { errorCode: "UPLOAD_FAILED", error: "Failed to upload receipt. Please try again." },
      { status: 500 }
    );
  }
}
