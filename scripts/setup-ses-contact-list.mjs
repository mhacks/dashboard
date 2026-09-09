import "dotenv/config";
import {
  CreateContactListCommand,
  GetContactListCommand,
  SESv2Client,
  UpdateContactListCommand,
} from "@aws-sdk/client-sesv2";

const region = process.env.SES_REGION ?? "us-east-2";
const contactListName = process.env.SES_CONTACT_LIST ?? "mhacks";
const topicName = process.env.SES_CONTACT_TOPIC ?? "event-updates";
const topic = {
  TopicName: topicName,
  DisplayName: "MHacks event updates",
  Description: "Optional MHacks newsletters and promotional announcements.",
  DefaultSubscriptionStatus: "OPT_IN",
};

const accessKeyId =
  process.env.AWS_SES_ACCESS_KEY_ID ??
  process.env.AWS_SES_SMTP_USER ??
  process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.AWS_SES_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
const credentials =
  accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
const client = new SESv2Client({ region, credentials });

async function setupContactList() {
  try {
    const existing = await client.send(
      new GetContactListCommand({ ContactListName: contactListName }),
    );
    const topics = existing.Topics ?? [];

    if (topics.some((existingTopic) => existingTopic.TopicName === topicName)) {
      console.log(
        `SES contact list ${contactListName} already has topic ${topicName} in ${region}.`,
      );
      process.exit(0);
    }

    await client.send(
      new UpdateContactListCommand({
        ContactListName: contactListName,
        Description:
          existing.Description ?? "MHacks email subscription preferences.",
        Topics: [...topics, topic],
      }),
    );
    console.log(
      `Added topic ${topicName} to SES contact list ${contactListName} in ${region}.`,
    );
  } catch (error) {
    if (error?.name !== "NotFoundException") {
      throw error;
    }

    await client.send(
      new CreateContactListCommand({
        ContactListName: contactListName,
        Description: "MHacks email subscription preferences.",
        Topics: [topic],
      }),
    );
    console.log(
      `Created SES contact list ${contactListName} with topic ${topicName} in ${region}.`,
    );
  }
}

try {
  await setupContactList();
} catch (error) {
  if (error?.name === "AccessDeniedException") {
    console.error(
      "SES setup was denied. Run this command with a provisioning identity that allows ses:GetContactList, ses:CreateContactList, and ses:UpdateContactList. The production sender only needs ses:SendEmail.",
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
}
