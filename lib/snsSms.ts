import 'server-only';

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const region = process.env.AWS_SNS_REGION || 'ap-south-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

const snsClient = new SNSClient({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export interface SendOtpSmsParams {
  to: string;
  otp: string;
}

/**
 * Sends an OTP SMS via Amazon SNS
 * @param phoneNumber - E.164 formatted number (e.g., +1234567890)
 */
export async function sendOtpSms({ to, otp }: SendOtpSmsParams) {
  const params = {
    Message: `Your verification code is ${otp}. It expires in 10 minutes.`,
    PhoneNumber: to,
    MessageAttributes: {
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: 'FrameForge'
      },
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional' // Crucial for OTP delivery
      }
    }
  };

  try {
    const data = await snsClient.send(new PublishCommand(params));
    console.log("OTP SMS sent successfully. MessageID:", data.MessageId);
    return data.MessageId;
  } catch (err: any) {
    console.error("Error sending OTP SMS via SNS:", err);
    throw new Error(err?.message || 'Failed to send SMS');
  }
}
