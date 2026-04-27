import 'server-only';

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const SNS_REGION = process.env.AWS_SNS_REGION?.trim() || 'ap-south-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim() || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';

let snsClient: SNSClient | null = null;

const getSnsClient = () => {
  if (!snsClient) {
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.warn('AWS credentials not found. SNS SMS will fail.');
    }
    snsClient = new SNSClient({
      region: SNS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return snsClient;
};

export const isSnsConfigured = () => {
  return Boolean(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY);
};

/**
 * Sends a transactional SMS using Amazon SNS.
 * @param phone The recipient's phone number in E.164 format (e.g., +919876543210).
 * @param message The SMS message content.
 * @returns The MessageId of the sent SMS.
 */
export const sendSms = async (phone: string, message: string) => {
  if (!isSnsConfigured()) {
    throw new Error('AWS SNS is not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
  }

  const client = getSnsClient();
  
  // Set SMS attributes for Transactional delivery
  const response = await client.send(
    new PublishCommand({
      PhoneNumber: phone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'Ellavarkkum',
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    })
  );

  return response.MessageId || null;
};

/**
 * Sends an OTP via SMS.
 */
export const sendOtpSms = async ({ to, otp }: { to: string; otp: string }) => {
  const message = `Your verification code for FrameForge is: ${otp}. It expires in 10 minutes.`;
  return sendSms(to, message);
};
