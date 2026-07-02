import { NextRequest, NextResponse } from 'next/server';

const BTS_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const { attachmentId, token, filename, contentType } = await request.json() as {
    attachmentId: string;
    token: string | null;
    filename: string;
    contentType: string;
  };

  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Step 1: Get presigned S3 URL from BTS API
  const presignRes = await fetch(`${BTS_API}/email-attachments/${attachmentId}`, {
    headers: authHeader,
  });
  if (!presignRes.ok) {
    const body = await presignRes.text().catch(() => '');
    console.error('[pdf-extract] Step 1 failed — presign:', presignRes.status, body);
    return NextResponse.json({ error: `BTS API error (${presignRes.status})` }, { status: 400 });
  }
  const { url } = await presignRes.json() as { url: string };
  console.log('[pdf-extract] Step 1 OK — presigned URL obtained');

  // Step 2: Download file from S3
  const s3Res = await fetch(url);
  if (!s3Res.ok) {
    console.error('[pdf-extract] Step 2 failed — S3 download:', s3Res.status);
    return NextResponse.json({ error: `S3 download failed (${s3Res.status})` }, { status: 400 });
  }
  const arrayBuffer = await s3Res.arrayBuffer();
  console.log('[pdf-extract] Step 2 OK — downloaded', arrayBuffer.byteLength, 'bytes');

  // Step 3: Upload to BTS extraction API
  const fd = new FormData();
  fd.append('file', new Blob([arrayBuffer], { type: contentType || 'application/pdf' }), filename);
  const uploadRes = await fetch(`${BTS_API}/upload`, {
    method: 'POST',
    body: fd,
    headers: authHeader,
  });
  const uploadBody = await uploadRes.text().catch(() => '');
  if (!uploadRes.ok) {
    console.error('[pdf-extract] Step 3 failed — upload:', uploadRes.status, uploadBody);
    return NextResponse.json({ error: `Upload failed (${uploadRes.status}): ${uploadBody}` }, { status: 400 });
  }

  console.log('[pdf-extract] Step 3 OK');
  return NextResponse.json(JSON.parse(uploadBody));
}
