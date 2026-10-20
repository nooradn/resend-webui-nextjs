# Resend Email Client

A small web interface for sending test emails through the [Resend](https://resend.com/) API. Enter a Resend API key, check the account's domains, compose an HTML email, and view request results in the activity log.

## Requirements

- Node.js 20.9 or later
- pnpm
- A Resend account and API key

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

No `.env` file is required. Enter your API key in the app's `RESEND_API_KEY` field. The app checks the key when entered and saves the form fields in your browser's local storage for convenience.

## Using the app

1. Enter a Resend API key. A key with permission to list domains can show the account's domains; a send-only key can still be used to send email.
2. Enter the sender email address and, optionally, a sender name.
3. Enter a recipient, subject, and email content. The content field accepts HTML.
4. Select **Send Email** and check the activity log for the result.

The sender address and domain must satisfy Resend's account and domain verification requirements.

## API routes

The Next.js server exposes two routes used by the interface:

- `POST /api/domains` accepts `{ "apiKey": "..." }` and returns the domains available to that key.
- `POST /api/send` accepts `{ "apiKey": "...", "from": "...", "to": "...", "subject": "...", "content": "..." }` and sends an email with `content` as HTML.

Both routes use the provided API key to make requests to Resend. They return JSON errors for invalid requests or Resend API errors.

## Security notes

- Treat your Resend API key like a password. Do not commit it, paste it into issues, or share screenshots that reveal it.
- This app stores the entered key and other form values in browser local storage under `resend-form`. Anyone with access to that browser profile may be able to retrieve them. Clear the app's saved site data when you're finished on a shared or untrusted device.
- The API routes accept a key from each request and do not implement user authentication. Run this as a personal/local utility, not as a publicly accessible email-sending service without adding appropriate authentication, authorization, and abuse protections.
- If a key may have been exposed, revoke it in Resend and create a replacement.

## Production

```bash
pnpm build
pnpm start
```

The production server listens on port 3000 by default. Set the `PORT` environment variable if you need a different port.
