import 'server-only';

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const SES_REGION = process.env.AWS_SES_REGION?.trim() || process.env.AWS_REGION?.trim() || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim() || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';
const SENDER_EMAIL = process.env.AWS_SES_FROM_EMAIL?.trim() || 'no-reply@frameforge.one';
const RETURN_PATH_EMAIL = process.env.AWS_SES_RETURN_PATH?.trim() || SENDER_EMAIL;
const SES_CONFIGURATION_SET = process.env.AWS_SES_CONFIGURATION_SET?.trim() || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
const DEFAULT_LOGO_URL = 'https://memento.frameforge.one/logo_black.png';
const SES_LOGO_URL = process.env.AWS_SES_LOGO_URL?.trim() || DEFAULT_LOGO_URL;

const isPublicAppUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return false;
    if (host.endsWith('.local')) return false;
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

let sesClient: SESClient | null = null;

const getSesClient = () => {
  if (!sesClient) {
    sesClient = new SESClient({
      region: SES_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  return sesClient;
};

export const isSesConfigured = () => {
  return Boolean(SES_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && SENDER_EMAIL);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getDisplayDate = () =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

const getDefaultLogoUrl = (publicUrl: string) => {
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, '')}/logo_black.png`;
  }
  return DEFAULT_LOGO_URL;
};

const buildOtpEmailHtml = (otp: string, helpCenterUrl: string, logoUrl: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Frame Forge OTP</title>

    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body
    style="
      margin: 0;
      font-family: 'Poppins', Arial, sans-serif;
      background: #f7f8fb;
      font-size: 14px;
    "
  >
    <div
      style="
        max-width: 680px;
        margin: 0 auto;
        padding: 45px 30px 60px;
        background: #ffffff;
        border: 1px solid #e7ebf2;
        border-radius: 24px;
        font-size: 14px;
        color: #434343;
      "
    >
      <header>
        <table style="width: 100%;">
          <tbody>
            <tr style="height: 0;">
              <td>
                <table style="border-collapse: collapse;">
                  <tbody>
                    <tr>
                      <td style="padding: 0; vertical-align: middle;">
                        <span
                          style="display: inline-block; background: #ffffff; padding: 6px 12px; border-radius: 14px; line-height: 0; border: 1px solid #eef1f6;"
                        >
                          <img
                            alt="Frame Forge"
                            src="${logoUrl}"
                            width="136"
                            height="34"
                            style="display: block; border: 0; outline: none; text-decoration: none; object-fit: contain; max-width: 100%;"
                          />
                        </span>
                      </td>
                      <td style="padding-left: 10px; vertical-align: middle;">
                        <span style="font-size: 16px; line-height: 30px; font-weight: 600; color: #1f2937; letter-spacing: 0.5px;">
                          FRAME FORGE
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style="text-align: right;">
                <span
                  style="font-size: 16px; line-height: 30px; color: #6b7280;"
                  >${getDisplayDate()}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </header>

      <main>
        <div
          style="
            margin: 0;
            margin-top: 70px;
            padding: 92px 30px 115px;
            background: #ffffff;
            border-radius: 30px;
            text-align: center;
            border: 1px solid #edf0f5;
          "
        >
          <div style="width: 100%; max-width: 489px; margin: 0 auto;">
            <h1
              style="
                margin: 0;
                font-size: 24px;
                font-weight: 500;
                color: #1f1f1f;
              "
            >
              Your OTP
            </h1>
            <p
              style="
                margin: 0;
                margin-top: 17px;
                font-size: 16px;
                font-weight: 500;
              "
            >
              Hello,
            </p>
            <p
              style="
                margin: 0;
                margin-top: 17px;
                font-weight: 500;
                letter-spacing: 0.2px;
                line-height: 1.7;
              "
            >
              Thank you for choosing Frame Forge. Use the following OTP
              to complete your email verification. OTP is valid for
              <span style="font-weight: 600; color: #1f1f1f;">10 minutes</span>.
              Do not share this code with anyone.
            </p>
            <p
              style="
                margin: 0;
                margin-top: 60px;
                font-size: 40px;
                font-weight: 600;
                letter-spacing: 25px;
                color: #ba3d4f;
              "
            >
              ${escapeHtml(otp)}
            </p>
          </div>
        </div>

        <p
          style="
            max-width: 400px;
            margin: 0 auto;
            margin-top: 90px;
            text-align: center;
            font-weight: 500;
            color: #6b7280;
          "
        >
          Need help? Visit our
          <a
            href="${helpCenterUrl}"
            target="_blank"
            rel="noopener noreferrer"
            style="color: #499fb6; text-decoration: none;"
            >Help Center</a
          >
        </p>
      </main>

      <footer
        style="
          width: 100%;
          max-width: 490px;
          margin: 20px auto 0;
          text-align: center;
          border-top: 1px solid #e6ebf1;
        "
      >
        <p
          style="
            margin: 0;
            margin-top: 40px;
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
          "
        >
          Frame Forge
        </p>
        <p style="margin: 0; margin-top: 8px; color: #6b7280;">
          AI image generation platform.
        </p>
        <p style="margin: 0; margin-top: 16px; color: #6b7280;">
          Copyright © ${new Date().getFullYear()} Frame Forge. All rights reserved.
        </p>
      </footer>
    </div>
  </body>
</html>`;

export const sendOtpEmail = async (input: { to: string; otp: string }) => {
  if (!isSesConfigured()) {
    throw new Error('AWS SES is not configured. Set AWS_REGION/AWS_SES_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.');
  }

  const client = getSesClient();
  const subject = 'Your Frame Forge OTP code';
  const publicUrl = isPublicAppUrl(APP_URL) ? APP_URL : '';
  const helpCenterUrl = publicUrl || 'https://frameforge.one';
  const logoUrl = SES_LOGO_URL || getDefaultLogoUrl(publicUrl);
  const appUrlTextLine = publicUrl || 'https://frameforge.one';
  const textBody = [
    `Your Frame Forge OTP is: ${input.otp}`,
    'This code is valid for 10 minutes.',
    '',
    'If you did not request this code, you can ignore this email.',
    '',
    `Help Center: ${helpCenterUrl}`,
    `Frame Forge: ${appUrlTextLine}`,
  ].join('\n');

  const response = await client.send(
    new SendEmailCommand({
      Source: `FrameForge Security <${SENDER_EMAIL}>`,
      ReturnPath: RETURN_PATH_EMAIL,
      ...(SES_CONFIGURATION_SET ? { ConfigurationSetName: SES_CONFIGURATION_SET } : {}),
      Destination: {
        ToAddresses: [input.to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: buildOtpEmailHtml(input.otp, helpCenterUrl, logoUrl),
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    })
  );

  return response.MessageId || null;
};
