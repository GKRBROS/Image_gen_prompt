import 'server-only';

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const SES_REGION = process.env.AWS_SES_REGION?.trim() || process.env.AWS_REGION?.trim() || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim() || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';
const SENDER_EMAIL = process.env.AWS_SES_FROM_EMAIL?.trim() || 'no-reply@mail.frameforge.one';
const RETURN_PATH_EMAIL = process.env.AWS_SES_RETURN_PATH?.trim() || SENDER_EMAIL;
const REPLY_TO_EMAIL = process.env.AWS_SES_REPLY_TO_EMAIL?.trim() || 'support@frameforge.one';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
const SES_LOGO_URL = process.env.AWS_SES_LOGO_URL?.trim() || '';

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
  return 'https://memento.frameforge.one/logo_black.png';
};

const buildOtpEmailText = (otp: string, helpCenterUrl: string, appUrl: string) => [
  'Frame Forge verification code',
  '',
  'Hello,',
  '',
  `Your verification code is: ${otp}`,
  'This code expires in 10 minutes.',
  '',
  'If you did not request this code, you can ignore this email.',
  '',
  `Help Center: ${helpCenterUrl}`,
  `Frame Forge: ${appUrl}`,
  '',
  `Copyright ${new Date().getFullYear()} Frame Forge. All rights reserved.`,
].join('\n');

const buildOtpEmailHtml = (otp: string, helpCenterUrl: string, logoUrl: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Frame Forge OTP</title>
  </head>
  <body
    style="
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #ffffff;
      font-size: 14px;
    "
  >
    <div
      style="
        max-width: 680px;
        margin: 0 auto;
        padding: 30px 20px;
        background: #f6f7fb;
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
                        <span style="display: inline-block; background: #ffffff; padding: 6px 10px; border-radius: 14px; line-height: 0;">
                          <img
                            alt="Frame Forge"
                            src="${logoUrl}"
                            width="110"
                            height="28"
                            style="display: block; border: 0; outline: none; text-decoration: none; object-fit: contain;"
                          />
                        </span>
                      </td>
                      <td style="padding-left: 10px; vertical-align: middle;">
                        <span style="font-size: 16px; line-height: 30px; font-weight: 600; color: #1f1f1f; letter-spacing: 0.5px;">
                          FRAME FORGE
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style="text-align: right;">
                <span
                  style="font-size: 16px; line-height: 30px; color: #434343;"
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
            margin-top: 24px;
            padding: 40px 20px 48px;
            background: #ffffff;
            border-radius: 10px;
            text-align: center;
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
              Verify your email
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
              Use the code below to verify your email. This code expires in
              <span style="font-weight: 600; color: #1f1f1f;">10 minutes</span>.
              If you did not request this code, you can ignore this email.
            </p>
            <p
              style="
                margin: 0;
                margin-top: 60px;
                font-size: 40px;
                font-weight: 600;
                letter-spacing: 15px;
                color: #000000;
              "
            >
              ${otp}
            </p>
          </div>
        </div>

        <p
          style="
            max-width: 400px;
            margin: 0 auto;
            margin-top: 30px;
            text-align: center;
            font-size: 14px;
            color: #8c8c8c;
            font-weight: 300;
          "
        >
          If you have any questions, feel free to visit our
          <a
            href="${helpCenterUrl}"
            target="_blank"
            style="color: #434343; text-decoration: underline"
            >Help Center</a
          >
          or contact us.
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
            margin-top: 20px;
            font-size: 14px;
            color: #434343;
          "
        >
          Copyright © ${new Date().getFullYear()} Frame Forge. All rights reserved.
        </p>
      </footer>
    </div>
  </body>
</html>
`;

const buildFinalImageEmailText = (name: string, imageUrl: string, appUrl: string) => [
  `Your Frame Forge image is ready, ${name}!`,
  '',
  'Hello,',
  '',
  'Great news! Your AI-powered transformation is complete. You can view and download your final image using the link below:',
  '',
  `${imageUrl}`,
  '',
  'Thank you for using Frame Forge!',
  '',
  `Frame Forge: ${appUrl}`,
  '',
  `Copyright ${new Date().getFullYear()} Frame Forge. All rights reserved.`,
].join('\n');

const buildFinalImageEmailHtml = (name: string, imageUrl: string, helpCenterUrl: string, logoUrl: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Your Image is Ready</title>
  </head>
  <body
    style="
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #ffffff;
      font-size: 14px;
    "
  >
    <div
      style="
        max-width: 680px;
        margin: 0 auto;
        padding: 30px 20px;
        background: #f6f7fb;
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
                        <span style="display: inline-block; background: #ffffff; padding: 6px 10px; border-radius: 14px; line-height: 0;">
                          <img
                            alt="Frame Forge"
                            src="${logoUrl}"
                            width="110"
                            height="28"
                            style="display: block; border: 0; outline: none; text-decoration: none; object-fit: contain;"
                          />
                        </span>
                      </td>
                      <td style="padding-left: 10px; vertical-align: middle;">
                        <span style="font-size: 16px; line-height: 30px; font-weight: 600; color: #1f1f1f; letter-spacing: 0.5px;">
                          FRAME FORGE
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style="text-align: right;">
                <span
                  style="font-size: 16px; line-height: 30px; color: #434343;"
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
            margin-top: 24px;
            padding: 40px 20px 48px;
            background: #ffffff;
            border-radius: 10px;
            text-align: center;
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
              Your Image is Ready!
            </h1>
            <p
              style="
                margin: 0;
                margin-top: 17px;
                font-size: 16px;
                font-weight: 500;
              "
            >
              Hello ${name},
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
              Great news! Your AI-powered transformation is complete. Click the button below to view and download your final image.
            </p>
            
            <div style="margin-top: 40px;">
              <a
                href="${imageUrl}"
                target="_blank"
                style="
                  display: inline-block;
                  padding: 14px 30px;
                  background-color: #000000;
                  color: #ffffff;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                "
              >
                Download Your Image
              </a>
            </div>
            
            <div style="margin-top: 40px; border-radius: 8px; overflow: hidden; border: 1px solid #e6ebf1;">
               <img src="${imageUrl}" alt="Generated Image" style="width: 100%; display: block;" />
            </div>
          </div>
        </div>

        <p
          style="
            max-width: 400px;
            margin: 0 auto;
            margin-top: 30px;
            text-align: center;
            font-size: 14px;
            color: #8c8c8c;
            font-weight: 300;
          "
        >
          If you have any questions, feel free to visit our
          <a
            href="${helpCenterUrl}"
            target="_blank"
            style="color: #434343; text-decoration: underline"
            >Help Center</a
          >
          or contact us.
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
            margin-top: 20px;
            font-size: 14px;
            color: #434343;
          "
        >
          Copyright © ${new Date().getFullYear()} Frame Forge. All rights reserved.
        </p>
      </footer>
    </div>
  </body>
</html>
`;

const buildAdminWelcomeEmailText = (name: string, adminUrl: string, appUrl: string) => [
  `Welcome to Frame Forge Admin, ${name}!`,
  '',
  'Hello,',
  '',
  'You have been added as an administrator for Frame Forge. You can now access the admin dashboard to manage requests and monitor generation status.',
  '',
  `Admin Dashboard: ${adminUrl}`,
  '',
  'Thank you,',
  'The Frame Forge Team',
  '',
  `Frame Forge: ${appUrl}`,
  '',
  `Copyright ${new Date().getFullYear()} Frame Forge. All rights reserved.`,
].join('\n');

const buildAdminWelcomeEmailHtml = (name: string, adminUrl: string, helpCenterUrl: string, logoUrl: string) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>Welcome to Frame Forge Admin</title>
  </head>
  <body
    style="
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #ffffff;
      font-size: 14px;
    "
  >
    <div
      style="
        max-width: 680px;
        margin: 0 auto;
        padding: 30px 20px;
        background: #f6f7fb;
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
                        <span style="display: inline-block; background: #ffffff; padding: 6px 10px; border-radius: 14px; line-height: 0;">
                          <img
                            alt="Frame Forge"
                            src="${logoUrl}"
                            width="110"
                            height="28"
                            style="display: block; border: 0; outline: none; text-decoration: none; object-fit: contain;"
                          />
                        </span>
                      </td>
                      <td style="padding-left: 10px; vertical-align: middle;">
                        <span style="font-size: 16px; line-height: 30px; font-weight: 600; color: #1f1f1f; letter-spacing: 0.5px;">
                          FRAME FORGE
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style="text-align: right;">
                <span
                  style="font-size: 16px; line-height: 30px; color: #434343;"
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
            margin-top: 24px;
            padding: 40px 20px 48px;
            background: #ffffff;
            border-radius: 10px;
            text-align: center;
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
              Admin Access Granted
            </h1>
            <p
              style="
                margin: 0;
                margin-top: 17px;
                font-size: 16px;
                font-weight: 500;
              "
            >
              Hello ${name},
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
              You have been added as an administrator for <strong>Frame Forge</strong>. You can now access the dashboard to manage requests and monitor activity.
            </p>
            
            <div style="margin-top: 40px;">
              <a
                href="${adminUrl}"
                target="_blank"
                style="
                  display: inline-block;
                  padding: 14px 30px;
                  background-color: #000000;
                  color: #ffffff;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                "
              >
                Go to Admin Dashboard
              </a>
            </div>
          </div>
        </div>

        <p
          style="
            max-width: 400px;
            margin: 0 auto;
            margin-top: 30px;
            text-align: center;
            font-size: 14px;
            color: #8c8c8c;
            font-weight: 300;
          "
        >
          If you have any questions about your admin access, feel free to visit our
          <a
            href="${helpCenterUrl}"
            target="_blank"
            style="color: #434343; text-decoration: underline"
            >Help Center</a
          >
          or contact the platform owner.
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
            margin-top: 20px;
            font-size: 14px;
            color: #434343;
          "
        >
          Copyright © ${new Date().getFullYear()} Frame Forge. All rights reserved.
        </p>
      </footer>
    </div>
  </body>
</html>
`;

export const sendOtpEmail = async (input: { to: string; otp: string }) => {
  if (!isSesConfigured()) {
    throw new Error('AWS SES is not configured. Set AWS_REGION/AWS_SES_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.');
  }

  const client = getSesClient();
  const subject = 'Frame Forge email verification code (valid for 10 minutes)';
  const publicUrl = isPublicAppUrl(APP_URL) ? APP_URL : '';
  const helpCenterUrl = publicUrl || 'https://frameforge.one';
  const logoUrl = SES_LOGO_URL
    || getDefaultLogoUrl(publicUrl);
  const appUrlTextLine = publicUrl || 'https://frameforge.one';
  const textBody = buildOtpEmailText(input.otp, helpCenterUrl, appUrlTextLine);

  const response = await client.send(
    new SendEmailCommand({
      Source: `FrameForge Security <${SENDER_EMAIL}>`,
      ReturnPath: RETURN_PATH_EMAIL,
      ReplyToAddresses: [REPLY_TO_EMAIL],
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

export const sendAdminWelcomeEmail = async (input: { to: string; name: string }) => {
  if (!isSesConfigured()) {
    throw new Error('AWS SES is not configured. Set AWS_REGION/AWS_SES_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.');
  }

  const client = getSesClient();
  const subject = 'Welcome to Frame Forge Admin';
  const publicUrl = isPublicAppUrl(APP_URL) ? APP_URL : '';
  const adminUrl = publicUrl ? `${publicUrl.replace(/\/$/, '')}/admin` : 'https://frameforge.one/admin';
  const helpCenterUrl = publicUrl || 'https://frameforge.one';
  const logoUrl = SES_LOGO_URL
    || getDefaultLogoUrl(publicUrl);
  const appUrlTextLine = publicUrl || 'https://frameforge.one';
  const textBody = buildAdminWelcomeEmailText(input.name, adminUrl, appUrlTextLine);

  const response = await client.send(
    new SendEmailCommand({
      Source: `FrameForge <${SENDER_EMAIL}>`,
      ReturnPath: RETURN_PATH_EMAIL,
      ReplyToAddresses: [REPLY_TO_EMAIL],
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
            Data: buildAdminWelcomeEmailHtml(input.name, adminUrl, helpCenterUrl, logoUrl),
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

export const sendFinalImageEmail = async (input: { to: string; name: string; imageUrl: string }) => {
  if (!isSesConfigured()) {
    throw new Error('AWS SES is not configured. Set AWS_REGION/AWS_SES_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.');
  }

  const client = getSesClient();
  const subject = 'Your Frame Forge transformation is complete!';
  const publicUrl = isPublicAppUrl(APP_URL) ? APP_URL : '';
  const helpCenterUrl = publicUrl || 'https://frameforge.one';
  const logoUrl = SES_LOGO_URL
    || getDefaultLogoUrl(publicUrl);
  const appUrlTextLine = publicUrl || 'https://frameforge.one';
  const textBody = buildFinalImageEmailText(input.name, input.imageUrl, appUrlTextLine);

  const response = await client.send(
    new SendEmailCommand({
      Source: `FrameForge <${SENDER_EMAIL}>`,
      ReturnPath: RETURN_PATH_EMAIL,
      ReplyToAddresses: [REPLY_TO_EMAIL],
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
            Data: buildFinalImageEmailHtml(input.name, input.imageUrl, helpCenterUrl, logoUrl),
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
