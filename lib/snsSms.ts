import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_SNS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY!,
  },
});

export class OtpService {
  static async sendOtp(phoneNumber: string, otpCode: string) {
    try {
      const message = `Your OTP code is: ${otpCode}. It will expire in 10 minutes.`;

      const command = new PublishCommand({
        Message: message,
        PhoneNumber: phoneNumber,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
      });

      const response = await snsClient.send(command);

      return {
        success: true,
        message: "OTP sent successfully",
        messageId: response.MessageId,
      };
    } catch (error: any) {
      // console.error("Error sending OTP:", error.message);

      return {
        success: false,
        message: "Failed to send OTP",
        error: error.message,
      };
    }
  }
}
