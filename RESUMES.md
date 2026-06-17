# Resume Uploads

Resumes are uploaded directly from the browser to AWS S3 using presigned PUT URLs. The S3 object URL is then stored in `hacker_applicants.resume`.

## Flow

1. User selects a PDF on the Academic Information step of the application form
2. The client calls the `getResumeUploadUrl(userId, fileName)` server action
3. The server generates a presigned S3 PUT URL (5-minute TTL) and returns it alongside the final object URL
4. The client PUT-requests the file directly to S3 — the file never routes through the Next.js server
5. On success, the S3 object URL is stored in the `resume` form field and persisted to the DB on final submission

## S3 Key Structure

```
resumes/{userId}/{timestamp}-{sanitized-filename}.pdf
```

## Environment Variables

| Variable | Description |
|---|---|
| `RESUMES_ACCESS_KEYS_ID` | AWS IAM access key ID |
| `RESUMES_SECRET_ACCESS_KEY` | AWS IAM secret access key |
| `RESUMES_BUCKET` | S3 bucket name |
| `RESUMES_REGION` | AWS region (e.g. `us-east-1`) |

## Relevant Files

| File | Role |
|---|---|
| `lib/aws/s3.ts` | S3 client + `getResumeUploadUrl` server action (imported directly by components) |
| `app/apply/hacker/components/academic-information.tsx` | File input — triggers upload, shows status |
| `app/apply/hacker/application-form.tsx` | Passes `userId` (profileId) to AcademicInformation |

## IAM Permissions Required

The IAM user needs `s3:PutObject` on the bucket:

```json
{
  "Effect": "Allow",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::mhacks-resumes-5e840a74/resumes/*"
}
```

## CORS Configuration (S3 Bucket)

The bucket must allow PUT requests from the app's origin:

```json
[
  {
    "AllowedHeaders": ["Content-Type"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain.com"],
    "ExposeHeaders": []
  }
]
```
