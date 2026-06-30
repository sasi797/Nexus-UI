import { NextRequest, NextResponse } from 'next/server';

const BTS_API     = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const TRILOGY_API = 'https://trilogy-api.wavetrain.cloud';
const TRILOGY_TOKEN    = process.env.TRILOGY_TOKEN ?? '';
const TRILOGY_USERNAME = process.env.TRILOGY_USERNAME ?? '';

function trilogyHeaders(): Record<string, string> {
  if (TRILOGY_TOKEN) return { Authorization: `Bearer ${TRILOGY_TOKEN}` };
  if (TRILOGY_USERNAME) {
    const encoded = Buffer.from(`${TRILOGY_USERNAME}:${TRILOGY_TOKEN}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  return {};
}

async function tryJson(text: string): Promise<unknown> {
  try { return JSON.parse(text); } catch { return null; }
}

export async function POST(request: NextRequest) {
  const { attachmentId, token, filename, contentType } = await request.json() as {
    attachmentId: string;
    token: string | null;
    filename: string;
    contentType: string;
  };

  // Step 1: Get presigned S3 URL from BTS API
  const presignRes = await fetch(`${BTS_API}/email-attachments/${attachmentId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!presignRes.ok) {
    const body = await presignRes.text().catch(() => '');
    console.error('[pdf-extract] Step 1 failed — BTS presign:', presignRes.status, body);
    return NextResponse.json({ error: `BTS API error (${presignRes.status})` }, { status: 400 });
  }
  const { url } = await presignRes.json() as { url: string };
  console.log('[pdf-extract] Step 1 OK — presigned URL obtained');

  // Step 2: Download file from S3 server-side (no browser CORS restriction)
  const s3Res = await fetch(url);
  if (!s3Res.ok) {
    console.error('[pdf-extract] Step 2 failed — S3 download:', s3Res.status);
    return NextResponse.json({ error: `S3 download failed (${s3Res.status})` }, { status: 400 });
  }
  const arrayBuffer = await s3Res.arrayBuffer();
  console.log('[pdf-extract] Step 2 OK — downloaded', arrayBuffer.byteLength, 'bytes');

  // Step 3: Upload to Trilogy extraction API
  const fd = new FormData();
  fd.append('file', new Blob([arrayBuffer], { type: contentType || 'application/pdf' }), filename);
  const uploadRes = await fetch(`${TRILOGY_API}/upload`, {
    method: 'POST',
    body: fd,
    headers: trilogyHeaders(),
  });
  const uploadBody = await uploadRes.text().catch(() => '');
  if (!uploadRes.ok) {
    console.error('[pdf-extract] Step 3 failed — Trilogy upload:', uploadRes.status, uploadBody);
    return NextResponse.json({ error: `Trilogy upload failed (${uploadRes.status}): ${uploadBody}` }, { status: 400 });
  }
  const uploadData = await tryJson(uploadBody);
  console.log('[pdf-extract] Step 3 OK — upload response:', uploadBody.slice(0, 300));

  // Step 4: Fetch history — take the most recent entry (index 0 = just uploaded)
  const historyRes = await fetch(`${TRILOGY_API}/history`, {
    headers: trilogyHeaders(),
  });
  const historyBody = await historyRes.text().catch(() => '');
  if (!historyRes.ok) {
    console.error('[pdf-extract] Step 4 failed — history:', historyRes.status, historyBody);
    // Fall back to upload response if history fails
    return NextResponse.json(uploadData ?? { error: `History fetch failed (${historyRes.status})` }, { status: 200 });
  }

  const historyAll = await tryJson(historyBody);
  const mostRecent = Array.isArray(historyAll) ? historyAll[0] : historyAll;
  console.log('[pdf-extract] Step 4 OK — most recent entry:', JSON.stringify(mostRecent)?.slice(0, 200));

  // Step 5: Try to get full detail for the most recent upload (extracted fields)
  const recentId = mostRecent && typeof mostRecent === 'object' ? (mostRecent as Record<string, unknown>).id : null;
  if (recentId) {
    const detailRes = await fetch(`${TRILOGY_API}/history/${recentId}`, {
      headers: trilogyHeaders(),
    });
    const detailBody = await detailRes.text().catch(() => '');
    console.log('[pdf-extract] Step 5 detail response:', detailRes.status, detailBody.slice(0, 300));
    if (detailRes.ok) {
      const detail = await tryJson(detailBody);
      if (detail) return NextResponse.json(detail);
    }
  }

  // Fallback: return most recent history entry or upload response
  return NextResponse.json(mostRecent ?? uploadData ?? {});
}
