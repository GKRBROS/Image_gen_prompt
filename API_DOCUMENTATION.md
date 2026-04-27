#

These endpoints are for secure admin authentication and management. Only registered admin phone numbers can request OTPs and register new admins. All security measures (CORS, rate limiting, OTP hashing, session binding, strict validation) are enforced as in the user flow.

**Session/OTP Expiry Note:**

- Admins must re-enter the OTP if they exit the dashboard UI or if the OTP validity period (default: 10 minutes) expires. This ensures that only actively verified admins can access the dashboard at any time.

---

### Admin: Request OTP

**Endpoint:** `POST /api/admin/request-otp`

**Description:** Generate and send a One-Time Password (OTP) via SMS to a registered admin for dashboard login.

**Request Headers:**

```
Content-Type: application/json
Origin: <allowed-origin>
```

*(Note: <allowed-origin> must be one of the domains listed in the Authentication section above, e.g., http://localhost:5173, https://frameforge.one, etc.)*

**Request Body:**

```json
{
  "success": true,
  "phone": "+919876543210",
  "expiresAt": "2026-04-20T10:25:00.000Z",
  "expiresInMinutes": 10,
  "smsSent": true
}
```

**Error Responses:**

- 400: `{ "error": "Phone number is required" }`
- 400: `{ "error": "Invalid content type" }` (Must start with `application/json`)
- 403: `{ "error": "Phone number is not a registered admin" }`
- 403: `{ "error": "Origin not allowed" }`
- 429: `{ "error": "Too many OTP requests", "retryAfterSeconds": 30 }`
- 500: `{ "error": "Failed to send OTP SMS" }`

---

### Admin: Verify OTP

**Endpoint:** `POST /api/admin/verify-otp`

**Description:** Verify the 6-digit code sent to the admin phone number.

**Request Headers:**

```
Content-Type: application/json
Origin: http://localhost:5173
```

**Request Body:**

```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Response (200 - Success):**

```json
{
  "success": true,
  "verified": true,
  "admin": {
    "phone": "+919876543210",
    "name": "Admin Name"
  }
}
```

**Error Responses:**

- 400: `{ "error": "Phone number and verification code are required" }`
- 400: `{ "error": "Verification code expired. Please request a new one." }`
- 400: `{ "error": "Incorrect verification code" }`
- 403: `{ "error": "Access denied" }` (Phone number is not a registered admin)
- 404: `{ "error": "No verification request found for this phone number" }`
- 500: `{ "error": "Unable to verify OTP" }`

---

### Admin: Register New Admin

**Endpoint:** `POST /api/admin/register`

**Description:** Register a new admin. Upon success, the new admin is added to the system and can request OTPs using their phone number.

**Request Headers:**

```
Content-Type: application/json
Origin: http://localhost:5173
```

**Request Body:**

```json
{
  "phone": "+919998887776",
  "name": "New Admin"
}
```

**Response (200 - Success):**

```json
{
  "success": true,
  "phone": "+919998887776",
  "name": "New Admin"
}
```

**Error Responses:**

- 400: `{ "error": "Phone number and name are required" }`
- 401: `{ "error": "Unauthorized" }`
- 409: `{ "error": "Failed to register admin (may already exist)" }`
- 429: `{ "error": "Too many registration requests", "retryAfterSeconds": 30 }`

---

### Admin: List Administrators

**Endpoint:** `GET /api/admin/list`

**Description:** Retrieve a list of all registered administrators.

**Request Headers:**

```
Origin: http://localhost:5173
```

**Response (200 - Success):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+919876543210",
    "name": "Admin Name",
    "created_at": "2026-04-20T10:25:00.000Z",
    "updated_at": "2026-04-20T10:25:00.000Z"
  }
]
```

**Error Responses:**

- 401: `{ "error": "Unauthorized" }`
- 403: `{ "error": "Origin not allowed" }`
- 500: `{ "error": "Failed to fetch administrators" }`

---

### Admin: Delete Administrator

**Endpoint:** `DELETE /api/admin/delete`

**Description:** Remove an administrator from the system by phone number.

**Request Headers:**

```
Content-Type: application/json
Origin: http://localhost:5173
```

**Request Body:**

```json
{
  "phone": "+919876543210"
}
```

**Response (200 - Success):**

```json
{
  "success": true,
  "phone": "+919876543210"
}
```

**Error Responses:**

- 400: `{ "error": "Admin phone number is required" }`
- 401: `{ "error": "Unauthorized" }`
- 403: `{ "error": "Cannot delete the only remaining administrator" }`
- 500: `{ "error": "Failed to remove administrator" }`

---

## Admin Database Tables

See `sql/admin_tables.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL UNIQUE REFERENCES admin_users(phone) ON DELETE CASCADE,
  otp_code_hash VARCHAR(255),
  otp_expires_at TIMESTAMP WITH TIME ZONE,
  otp_verified_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

**Security Measures:**

- Strict CORS (admin origins only)
- Rate limiting (per IP/phone)
- OTPs hashed and never stored in plaintext
- Session binding and expiration
- Only registered admins can request OTP via SMS
- Only authenticated admins can register new admins
- All validation and error handling as in user flow

---

# AI Image Generation API Documentation

Complete API reference for the AI Image Generation service. These APIs enable phone verification, image generation, and AI-powered image-to-Arcane-style transformation.

## Base URL

```
https://memento.frameforge.one
https://frameforge.one
http://localhost:3000  (development)
http://localhost:5173  (development)
```

## Authentication

All requests must include the `Origin` header from an allowed domain:

**Allowed Origins:**

- `http://localhost:3000`
- `http://localhost:5173`
- `https://frameforge.one`
- `https://www.frameforge.one`
- `https://memento.frameforge.one`
- `https://frameforge-mauve.vercel.app`

Requests from other origins will be rejected with a CORS error.

---

## Endpoints

### 1. Request OTP (Phone Verification)

**Endpoint:** `POST /api/auth/request-otp`

**Description:** Generate and send a One-Time Password (OTP) to the user's phone number via Amazon SNS SMS.

**Request Headers:**

```
Content-Type: application/json
Origin: <allowed-origin>
```

**Request Body:**

```json
{
  "phone": "+919876543210"
}
```

**Response (200 - Success):**

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "phone": "+919876543210",
  "expiresAt": "2026-04-20T10:25:00.000Z",
  "expiresInMinutes": 10,
  "smsSent": true,
  "messageId": "SMS-MESSAGE-ID-FROM-SNS"
}
```

**Error Responses:**

- **400 Bad Request:**

  ```json
  { "error": "Phone number is required" }
  ```

- **409 Conflict (Already Completed):**

  ```json
  {
    "error": "This phone number has already completed generation. Please use a different phone number."
  }
  ```

- **429 Too Many Requests:**

  ```json
  {
    "error": "Too many OTP requests. Please try again shortly.",
    "retryAfterSeconds": 30
  }
  ```

- **500 Internal Server Error:**
  ```json
  { "error": "Failed to send OTP SMS" }
  ```

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"phone":"+919876543210"}'
```

**Example JavaScript:**

```javascript
const response = await fetch("/api/auth/request-otp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: "user@example.com" }),
});

const data = await response.json();
if (response.ok) {
  console.log("OTP sent to:", data.phone);
  console.log("Expires in:", data.expiresInMinutes, "minutes");
} else {
  console.error("Error:", data.error);
}
```

**Behavior Note (current):**

- If the phone number has an existing request that is **not completed**, requesting OTP again will update the existing row (upsert) and send a new code via SMS.
- Only phone numbers with `generation_status = completed` are rejected with `409`.
- Upon successful generation, the final image path is logged and saved to the database. (SMS delivery of final image link is optional).

---

### 2. Verify OTP

**Endpoint:** `POST /api/auth/verify-otp`

**Description:** Verify the OTP code sent to the user's phone number.

**Request Headers:**

```
Content-Type: application/json
Origin: <allowed-origin>
```

**Request Body:**

```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Response (200 - Success):**

```json
{
  "success": true,
  "verified": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses:**

- **400 Bad Request (Invalid OTP Format):**

  ```json
  { "error": "Enter the 6-digit verification code" }
  ```

- **400 Bad Request (OTP Expired):**

  ```json
  { "error": "Verification code expired. Request a new code." }
  ```

- **400 Bad Request (Incorrect OTP):**

  ```json
  { "error": "Incorrect verification code" }
  ```

- **404 Not Found:**

  ```json
  { "error": "No OTP request found for this phone number" }
  ```

- **500 Internal Server Error:**

  ```json
  { "error": "Unable to verify OTP" }
  ```

- **429 Too Many Requests:**
  ```json
  {
    "error": "Too many verification attempts. Please wait and try again.",
    "retryAfterSeconds": 30
  }
  ```

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"phone":"+919876543210","otp":"123456"}'
```

**Example JavaScript:**

```javascript
const response = await fetch("/api/auth/verify-otp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "user@example.com",
    otp: "123456",
  }),
});

const data = await response.json();
if (response.ok && data.verified) {
  console.log("Phone verified! Request ID:", data.requestId);
} else {
  console.error("Verification failed:", data.error);
}
```

---

### 3. Generate Arcane-Style Image

**Endpoint:** `POST /api/generate`

**Description:** Upload a photo and generate an Arcane-style AI illustration with background merging.

**Request Headers:**

```
Origin: <allowed-origin>
```

**Request Body (Form Data):**

```
photo: <File>              - Image file (PNG, JPEG, WEBP)
phone: string              - User's verified phone number
requestId: string          - OTP request ID from verify-otp response
name: string               - User's name for prompt
organization: string       - Organization name for prompt
gender: string (optional)  - "male", "female", or "neutral" (default: "neutral")
```

**Response (200 - Success):**

```json
{
  "success": true,
  "uploadedImage": "https://.../uploads/upload-1713607500000.png",
  "generatedImage": "https://.../generated/generated-1713607500000.png",
  "finalImage": "/final/final-1713607500000.png",
  "finalImageUrl": "https://memento.frameforge.one/api/assets/download?url=...",
  "dbId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "prompt": "..."
}
```

**Error Responses:**

- **400 Bad Request (Missing Fields):**

  ```json
  { "error": "Phone number is required" }
  { "error": "No photo provided" }
  { "error": "Name is required" }
  { "error": "Organization is required" }
  ```

- **400 Bad Request (Invalid Image Type):**

  ```json
  { "error": "Only PNG, JPEG/JPG, or WEBP images are allowed" }
  ```

- **403 Forbidden (Email Not Verified):**

  ```json
  { "error": "Phone number is not verified yet" }
  ```

- **404 Not Found:**

  ```json
  { "error": "No verified request found for this phone number" }
  { "error": "No matching verified request found" }
  ```

- **500 Internal Server Error:**

  ```json
  { "error": "Unable to validate session" }
  { "error": "Internal Server Error" }
  ```

- **504 Gateway Timeout:**

  ```json
  {
    "error": "Generation timed out due to upstream inactivity. Please try again with a shorter prompt or retry."
  }
  ```

- **429 Too Many Requests:**
  ```json
  {
    "error": "Too many generation requests. Please wait and retry.",
    "retryAfterSeconds": 30
  }
  ```

**Example JavaScript (with Fetch):**

```javascript
// After phone verification (verify-otp succeeded)
const formData = new FormData();
formData.append("photo", photoFile); // File object from input
formData.append("phone", "+919876543210");
formData.append("requestId", requestId); // from verify-otp response
formData.append("name", "John Doe");
formData.append("organization", "Acme Corp");
formData.append("gender", "male"); // optional: 'male', 'female', 'neutral'

const response = await fetch("/api/generate", {
  method: "POST",
  body: formData,
});

const data = await response.json();
if (response.ok && data.success) {
  console.log("Generated image:", data.generatedImage);
  console.log("Final image:", data.finalImageUrl);
} else {
  console.error("Generation failed:", data.error);
}
```

**Image Upload Handling:**

```javascript
// From HTML file input
const fileInput = document.getElementById("photoInput");
const file = fileInput.files[0];

// Or create from canvas
canvas.toBlob((blob) => {
  const file = new File([blob], "photo.png", { type: "image/png" });
  // Use file in formData
});
```

---

### 3.1 Reset Generation For Existing Email (Retry)

**Endpoint:** `POST /api/generate/reset`

**Description:** Clears previously generated image fields for an already-verified phone request so the same phone number can generate again.

**Request Headers:**

```
Content-Type: application/json
Origin: <allowed-origin>
```

**Request Body:**

```json
{
  "phone": "+919876543210",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

`requestId` is optional. If omitted, the latest request for the phone number is reset.

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "Generation state reset. You can generate again for this phone number.",
  "phone": "+919876543210",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "email_verified"
}
```

**Error Responses:**

- **400 Bad Request:**

  ```json
  { "error": "Phone number is required" }
  ```

- **403 Forbidden:**

  ```json
  { "error": "Phone number is not verified for this request" }
  ```

- **404 Not Found:**

  ```json
  { "error": "No request found for this phone number" }
  ```

- **500 Internal Server Error:**

  ```json
  { "error": "Unable to reset generation request" }
  ```

- **429 Too Many Requests:**
  ```json
  {
    "error": "Too many reset requests. Please wait before trying again.",
    "retryAfterSeconds": 30
  }
  ```

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/generate/reset \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"phone":"+919876543210","requestId":"550e8400-e29b-41d4-a716-446655440000"}'
```

---

### 4. Generation Callback (WebSocket Alternative)

**Endpoint:** `POST /api/callback`

**Description:** Receive generation completion callbacks from the AI service (typically used with webhook/async flows).

**Query Parameters:**

```
jobId: string  - Unique job identifier
```

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "status": "SUCCESS",
  "output": {
    "image_url": "https://example.com/generated-image.png"
  }
}
```

**Response (200 - Success):**

```json
{
  "success": true,
  "message": "Image processed successfully",
  "jobId": "job-123456"
}
```

**Error Responses:**

- **400 Bad Request:**

  ```json
  { "error": "Job ID not provided" }
  ```

- **500 Internal Server Error:**
  ```json
  { "error": "Failed to process generated image" }
  ```

---

### 5. Download Final Asset (CORS-safe Proxy)

**Endpoint:** `GET /api/assets/download`

**Description:** Server-side proxy for S3/final images to avoid browser CORS failures and optionally force download.

**Query Parameters:**

```
url: string (required)        - HTTPS asset URL
download: "1" (optional)     - Force attachment download
filename: string (optional)   - Download filename (max 120 chars)
apiKey: string (optional)     - Required only if DOWNLOAD_API_KEY(S) is configured
```

**Headers (optional auth alternative):**

```
x-download-api-key: <key>
```

**Common Errors:**

- `400` invalid/missing query fields
- `401` unauthorized key
- `403` asset host not allowed
- `429` rate limited
- `502` upstream storage fetch failed

---

## Usage Flow

1.  **Request OTP**: Call `POST /api/auth/request-otp` with the user's `phone`. A 6-digit code is sent via SMS.
2.  **Verify OTP**: Call `POST /api/auth/verify-otp` with the `phone` and the received `otp`. This verifies the number and binds it to the session.
3.  **Generate**: Call `POST /api/generate` with the `phone`, `requestId`, and photo.
4.  **Download**: Use the `finalImageUrl` or call `GET /api/assets/download` to retrieve the results.

### Step 1: Request OTP

```
POST /api/auth/request-otp
### Step 1: Request OTP

```
POST /api/auth/request-otp
Body: { "phone": "+919876543210" }
↓
Response: { "requestId": "...", "expiresInMinutes": 10 }
```

### Step 2: Verify OTP (User enters 6-digit code from SMS)

```
POST /api/auth/verify-otp
Body: { "phone": "+919876543210", "otp": "123456" }
↓
Response: { "verified": true, "requestId": "..." }
```

### Step 3: Generate Image

```
POST /api/generate
Body: (FormData)
  - photo: <File>
  - phone: "+919876543210"
  - requestId: "<from verify response>"
  - name: "John Doe"
  - organization: "Acme Corp"
  - gender: "male"
↓
Response: { "success": true, "finalImageUrl": "..." }
```

### Optional Step: Reset and Regenerate For Same Phone Number

```
POST /api/generate/reset
Body: { "phone": "+919876543210", "requestId": "<existing-request-id>" }
↓
Response: { "success": true, "status": "email_verified" }

Then call POST /api/generate again using the same phone number and requestId.
```

---

## Environment Variables

The API requires the following environment variables to function:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AWS SNS (SMS)
AWS_SNS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# AWS S3 (Optional - Image Storage)
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_S3_ACCESS_KEY_ID=your-access-key
AWS_S3_SECRET_ACCESS_KEY=your-secret-key

# OpenRouter (AI Image Generation)
OPENROUTER_API_KEY=your-api-key
OPENROUTER_IMAGE_MODELS=sourceful/riverflow-v2-fast-preview

# Development
EXPOSE_OTP_IN_RESPONSE=false (set to 'true' for testing)
```

---

## Error Handling

All API responses follow a standard format:

**Success (2xx):**

```json
{
  "success": true,
  "...endpoint specific fields...": "..."
}
```

**Error (4xx/5xx):**

```json
{
  "error": "Human-readable error message"
}
```

**CORS Errors (400):**

```
Origin header not allowed. Ensure your domain is in the allowlist.
```

---

## Security Features

1. **CORS Protection:** Only whitelisted origins can call these APIs.
2. **Phone Normalization:** Phone numbers are trimmed and whitespace removed.
3. **OTP Hashing:** OTPs are never stored in plaintext; hashed with phone + salt.
4. **Rate Limiting:** OTP attempts are tracked (verification_attempts field).
5. **Expiration:** OTPs expire after 10 minutes.
6. **Session Binding:** OTP verification is tied to phone + requestId.
7. **Strict Validation:** Unexpected JSON/form/query fields are rejected.
8. **Secret Safety:** API/download key checks use timing-safe comparison.

---

## Rate Limits

- **OTP Request (`/api/auth/request-otp`):** 20/10min per IP, 5/10min per phone
- **OTP Verify (`/api/auth/verify-otp`):** 40/10min per IP, 10/10min per phone
- **Generate (`/api/generate`):** 15/10min per IP, 5/10min per phone
- **Reset (`/api/generate/reset`):** 20/10min per IP, 8/10min per phone
- **Asset Download (`/api/assets/download`):** 120/min per IP, 60/min per key/url
- **Callback GET:** 120/min per IP, 60/min per jobId
- **Callback POST:** 60/min per IP, 30/min per jobId

---

## Database Schema

### image_generation_requests Table

```sql
CREATE TABLE image_generation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  otp_code_hash VARCHAR(255),
  otp_expires_at TIMESTAMP WITH TIME ZONE,
  otp_verified_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_attempts INTEGER DEFAULT 0,
  generation_status VARCHAR(50) DEFAULT 'otp_pending',
  uploaded_image_url TEXT,
  generated_image_url TEXT,
  final_image_url TEXT,
  user_name VARCHAR(255),
  user_organization VARCHAR(255),
  user_gender VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Integration Guide

### Next.js Frontend Example

```typescript
// lib/api.ts
export async function requestOtp(phone: string) {
  const response = await fetch("/api/auth/request-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone }),
  });
  return response.json();
}

export async function verifyOtp(phone: string, otp: string) {
  const response = await fetch("/api/auth/verify-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, otp }),
  });
  return response.json();
}

export async function generateImage(
  photo: File,
  phone: string,
  requestId: string,
  name: string,
  organization: string,
  gender?: string,
) {
  const formData = new FormData();
  formData.append("photo", photo);
  formData.append("phone", phone);
  formData.append("requestId", requestId);
  formData.append("name", name);
  formData.append("organization", organization);
  if (gender) formData.append("gender", gender);

  const response = await fetch("/api/generate", {
    method: "POST",
    body: formData,
  });
  return response.json();
}
```

### React Component Example

```typescript
import { useState } from 'react';
import { requestOtp, verifyOtp, generateImage } from '@/lib/api';

export function ImageGeneration() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [requestId, setRequestId] = useState('');
  const [step, setStep] = useState('phone'); // phone -> otp -> photo -> generating
  const [finalImage, setFinalImage] = useState('');

  const handleRequestOtp = async () => {
    const data = await requestOtp(phone);
    if (data.success) {
      setRequestId(data.requestId);
      setStep('otp');
    } else {
      alert(data.error);
    }
  };

  const handleVerifyOtp = async () => {
    const data = await verifyOtp(phone, otp);
    if (data.verified) {
      setStep('photo');
    } else {
      alert(data.error);
    }
  };

  const handleGenerate = async () => {
    if (!photo || !name || !organization) {
      alert('Please fill all fields');
      return;
    }
    setStep('generating');
    const data = await generateImage(photo, phone, requestId, name, organization);
    if (data.success) {
      setFinalImage(data.finalImageUrl);
      setStep('done');
    } else {
      alert(data.error);
      setStep('photo');
    }
  };

  if (step === 'phone') {
    return (
      <div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter phone number (+E.164)"
        />
        <button onClick={handleRequestOtp}>Send OTP</button>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter 6-digit OTP"
          maxLength={6}
        />
        <button onClick={handleVerifyOtp}>Verify</button>
      </div>
    );
  }

  if (step === 'photo') {
    return (
      <div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.files?.[0] || null)}
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <input
          type="text"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="Organization"
        />
        <button onClick={handleGenerate}>Generate Image</button>
      </div>
    );
  }

  if (step === 'done') {
    return <img src={finalImage} alt="Generated" />;
  }

  return <p>Generating...</p>;
}
```

---

## Troubleshooting

| Issue                                         | Solution                                                     |
| --------------------------------------------- | ------------------------------------------------------------ |
| CORS error                                    | Ensure your domain is in the allowed origins list            |
| "This email has already completed generation" | Use a different email, or use your existing generated result |
| OTP expires too quickly                       | OTPs expire after 10 minutes; request a new one              |
| Image upload fails                            | Ensure file is PNG, JPEG, or WEBP format (<10MB)             |
| Generation times out                          | Try a smaller/simpler image; retries occur automatically     |
| "Email not verified"                          | Complete the OTP verification step first                     |

---

## Support

For API issues or integration questions, contact: `support@frameforge.one`

---

**Last Updated:** April 27, 2026  
**API Version:** 1.1.0
