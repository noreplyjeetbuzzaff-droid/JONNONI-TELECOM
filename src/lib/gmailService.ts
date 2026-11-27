export interface SendGmailParams {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
}

export interface GmailSendResult {
  id: string;
  threadId?: string;
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function utf8ToBase64Url(str: string): string {
  return utf8ToBase64(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeRfc2047Subject(subject: string): string {
  const clean = subject.replace(/[\r\n]+/g, ' ').trim();
  return `=?UTF-8?B?${utf8ToBase64(clean)}?=`;
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(trimmed) && trimmed.length <= 160;
}

export async function sendGmailMessage({
  accessToken,
  to,
  subject,
  body,
}: SendGmailParams): Promise<GmailSendResult> {
  const safeTo = to.replace(/[\r\n]+/g, '').trim();
  if (!isValidEmailAddress(safeTo)) {
    throw new Error(`সঠিক ইমেইল ঠিকানা দিন: ${safeTo}`);
  }

  const cleanSubject = subject.replace(/[\r\n]+/g, ' ').trim();
  if (!cleanSubject) {
    throw new Error('ইমেইলের বিষয় (Subject) খালি রাখা যাবে না।');
  }

  const encodedBody = utf8ToBase64(body.trim());
  const rfc2822 = [
    `To: ${safeTo}`,
    `Subject: ${encodeRfc2047Subject(cleanSubject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody,
  ].join('\r\n');

  const raw = utf8ToBase64Url(rfc2822);

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail পাঠানো ব্যর্থ হয়েছে (${res.status}): ${errText}`);
  }

  return (await res.json()) as GmailSendResult;
}

export function buildNewAdminBanglaEmail(params: {
  newAdminEmail: string;
  shopName: string;
  siteUrl: string;
  administratorEmail: string;
}): { subject: string; body: string } {
  const { newAdminEmail, shopName, siteUrl, administratorEmail } = params;
  return {
    subject: `অভিনন্দন! আপনি ${shopName}-এর অ্যাডমিন হিসেবে যুক্ত হয়েছেন`,
    body: [
      `আসসালামু আলাইকুম / শুভেচ্ছা,`,
      '',
      `আপনাকে আনন্দের সাথে জানানো যাচ্ছে যে আপনার ইমেইল (${newAdminEmail}) এখন "${shopName}" ওয়েবসাইটের অনুমোদিত অ্যাডমিন (Admin) হিসেবে সফলভাবে যুক্ত করা হয়েছে।`,
      '',
      `আপনি এখন অ্যাডমিন প্যানেলে লগইন করে নিচের কাজগুলো পরিচালনা করতে পারবেন:`,
      `১. সকল মডেলের ফ্ল্যাশ ফাইল, স্টক রম, ড্রাইভার ও টুলস গুগল ড্রাইভে আপলোড ও প্রকাশ করা`,
      `২. রিয়েল-টাইম ভিজিটর ও ডাউনলোড পরিসংখ্যান দেখা`,
      `৩. শপ ২৪ ঘণ্টা খোলা/বন্ধ স্ট্যাটাস, গুগল ম্যাপ লোকেশন, হেডার কালার ও SEO মেটা ট্যাগ আপডেট করা`,
      '',
      `অ্যাডমিন প্যানেল ব্যবহারের নিয়ম:`,
      `- ওয়েবসাইটে যান: ${siteUrl}`,
      `- উপরের "অ্যাডমিন প্যানেল" বাটনে ক্লিক করুন`,
      `- আপনার অনুমোদিত গুগল অ্যাকাউন্ট (${newAdminEmail}) দিয়ে "Sign in with Google" করুন`,
      '',
      `যেকোনো প্রয়োজনে প্রধান অ্যাডমিনিস্ট্রেটর (${administratorEmail}) অথবা হেল্পলাইন 01738266366 নম্বরে যোগাযোগ করুন।`,
      '',
      `ধন্যবাদান্তে,`,
      `${shopName}`,
      `মানিকগঞ্জ, খানসামা, দিনাজপুর`,
    ].join('\n'),
  };
}

export function buildAdministratorAlertEmail(params: {
  newAdminEmail: string;
  administratorEmail: string;
  actorEmail: string;
  shopName: string;
  siteUrl: string;
}): { subject: string; body: string } {
  const { newAdminEmail, actorEmail, shopName, siteUrl } = params;
  const nowStr = new Date().toLocaleString('bn-BD', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return {
    subject: `[অ্যাডমিন অ্যালার্ট] নতুন অ্যাডমিন যুক্ত হয়েছে: ${newAdminEmail}`,
    body: [
      `অ্যাডমিনিস্ট্রেটর অ্যালার্ট — ${shopName}`,
      '',
      `নতুন অ্যাডমিন অ্যাকাউন্ট সফলভাবে তৈরি ও অনুমোদিত হয়েছে।`,
      '',
      `বিস্তারিত তথ্য:`,
      `- নতুন অ্যাডমিন ইমেইল: ${newAdminEmail}`,
      `- অনুমোদনকারী অ্যাডমিন: ${actorEmail}`,
      `- সময় (বাংলাদেশ সময়): ${nowStr}`,
      `- ওয়েবসাইট: ${siteUrl}`,
      '',
      `নতুন অ্যাডমিন এখন Google Sign-In ব্যবহার করে অ্যাডমিন ড্যাশবোর্ডে প্রবেশ করতে পারবেন।`,
      '',
      `— ${shopName} সিস্টেম নোটিফিকেশন`,
    ].join('\n'),
  };
}
