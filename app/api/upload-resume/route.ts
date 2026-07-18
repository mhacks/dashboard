import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { RESUMES_BUCKET, s3, MAX_RESUME_SIZE_BYTES } from "@/lib/aws/s3";
import { createClient } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds ${MAX_RESUME_SIZE_BYTES / (1024 * 1024)}MB limit`,
      },
      { status: 400 },
    );
  }

  const key = `resumes/${user.id}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: RESUMES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      ContentLength: buffer.length,
    }),
  );

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: user.id,
    event: "resume_uploaded",
    properties: { file_size_bytes: file.size },
  });
  await posthog.flush();

  return NextResponse.json({ key });
}
