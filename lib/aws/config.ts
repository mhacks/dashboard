// TODO: populate these in .env.local before deploying
export const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ?? "";
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? "";

// TODO: verified SES sender address (must be verified in AWS SES console)
export const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS ?? "";

// TODO: End User Messaging origination identity (phone number or pool ARN from AWS console)
export const EUM_ORIGINATION_NUMBER = process.env.EUM_ORIGINATION_NUMBER ?? "";
