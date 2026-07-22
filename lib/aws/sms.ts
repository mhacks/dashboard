import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  EUM_ORIGINATION_NUMBER,
} from "./config";

const client = new PinpointSMSVoiceV2Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export async function sendBulkSMS(
  phoneNumbers: string[],
  message: string
): Promise<{ succeeded: string[] }> {
  const results = await Promise.allSettled(
    phoneNumbers.map((phone) =>
      client.send(
        new SendTextMessageCommand({
          DestinationPhoneNumber: phone,
          OriginationIdentity: EUM_ORIGINATION_NUMBER,
          MessageBody: message,
        })
      )
    )
  );
  const succeeded = phoneNumbers.filter(
    (_, i) => results[i].status === "fulfilled"
  );
  return { succeeded };
}
