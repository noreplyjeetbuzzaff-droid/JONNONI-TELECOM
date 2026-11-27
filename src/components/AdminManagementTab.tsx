import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Mail,
  MessageSquare,
  Send,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  BOOTSTRAPPED_ADMIN_EMAILS,
  checkTokenScopes,
} from '../lib/firebase';
import {
  buildAdministratorAlertEmail,
  buildNewAdminBanglaEmail,
  isValidEmailAddress,
  sendGmailMessage,
} from '../lib/gmailService';
import { ConfirmDialog } from './ConfirmDialog';
import { GoogleSignInButton } from './GoogleSignInButton';
import { LoadingSpinner } from './LoadingSpinner';

interface AdminManagementTabProps {
  currentAdminEmail: string;
  shopName: string;
  accessToken: string | null;
  onConnectWorkspace: () => Promise<void>;
  onClearToken?: () => void;
}

interface DeliveryReportItem {
  recipient: string;
  roleLabel: string;
  ok: boolean;
  message: string;
}

export const AdminManagementTab: React.FC<AdminManagementTabProps> = ({
  currentAdminEmail,
  shopName,
  accessToken,
  onConnectWorkspace,
  onClearToken,
}) => {
  const siteUrl = useMemo(
    () =>
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://jonnoitelecom.com',
    []
  );

  const initialWelcome = useMemo(
    () =>
      buildNewAdminBanglaEmail({
        newAdminEmail: 'jononitelecom266366@gmail.com',
        shopName,
        siteUrl,
        administratorEmail: BOOTSTRAPPED_ADMIN_EMAIL,
      }),
    [shopName, siteUrl]
  );

  const initialAlert = useMemo(
    () =>
      buildAdministratorAlertEmail({
        newAdminEmail: 'jononitelecom266366@gmail.com',
        administratorEmail: BOOTSTRAPPED_ADMIN_EMAIL,
        actorEmail: currentAdminEmail || BOOTSTRAPPED_ADMIN_EMAIL,
        shopName,
        siteUrl,
      }),
    [shopName, siteUrl, currentAdminEmail]
  );

  const [newAdminEmail, setNewAdminEmail] = useState(
    'jononitelecom266366@gmail.com'
  );
  const [administratorEmail, setAdministratorEmail] = useState(
    BOOTSTRAPPED_ADMIN_EMAIL
  );
  const [welcomeSubject, setWelcomeSubject] = useState(initialWelcome.subject);
  const [welcomeBody, setWelcomeBody] = useState(initialWelcome.body);
  const [sendAlertCopy, setSendAlertCopy] = useState(true);
  const [alertSubject, setAlertSubject] = useState(initialAlert.subject);
  const [alertBody, setAlertBody] = useState(initialAlert.body);
  const [smsPhone, setSmsPhone] = useState('01738266366');

  const [hasGmailScope, setHasGmailScope] = useState(false);
  const [checkingScope, setCheckingScope] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [deliveryReport, setDeliveryReport] = useState<DeliveryReportItem[]>(
    []
  );

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      setHasGmailScope(false);
      return;
    }
    setCheckingScope(true);
    checkTokenScopes(accessToken)
      .then((scopes) => {
        if (!cancelled) {
          setHasGmailScope(scopes.hasGmailSend);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingScope(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const handleRegenerateTemplates = (targetEmail: string) => {
    const cleanTarget = targetEmail.trim() || 'jononitelecom266366@gmail.com';
    const nextWelcome = buildNewAdminBanglaEmail({
      newAdminEmail: cleanTarget,
      shopName,
      siteUrl,
      administratorEmail: administratorEmail.trim() || BOOTSTRAPPED_ADMIN_EMAIL,
    });
    const nextAlert = buildAdministratorAlertEmail({
      newAdminEmail: cleanTarget,
      administratorEmail: administratorEmail.trim() || BOOTSTRAPPED_ADMIN_EMAIL,
      actorEmail: currentAdminEmail || BOOTSTRAPPED_ADMIN_EMAIL,
      shopName,
      siteUrl,
    });
    setWelcomeSubject(nextWelcome.subject);
    setWelcomeBody(nextWelcome.body);
    setAlertSubject(nextAlert.subject);
    setAlertBody(nextAlert.body);
  };

  const handleConnectClick = async () => {
    setConnectingGoogle(true);
    setConnectError(null);
    try {
      await onConnectWorkspace();
    } catch (err) {
      setConnectError(
        err instanceof Error
          ? err.message
          : 'Gmail অনুমতি সংযুক্ত করতে সমস্যা হয়েছে।'
      );
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleOpenSendConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setDeliveryReport([]);

    if (!accessToken || !hasGmailScope) {
      setSendError(
        'ইমেইল পাঠাতে প্রথমে নিচের "Sign in with Google (Gmail অনুমতি দিন)" বাটনে ক্লিক করে Gmail অনুমতি সংযুক্ত করুন।'
      );
      return;
    }
    if (!isValidEmailAddress(newAdminEmail)) {
      setSendError('নতুন অ্যাডমিনের সঠিক ইমেইল ঠিকানা লিখুন।');
      return;
    }
    if (sendAlertCopy && !isValidEmailAddress(administratorEmail)) {
      setSendError('অ্যাডমিনিস্ট্রেটরের সঠিক ইমেইল ঠিকানা লিখুন।');
      return;
    }
    if (!welcomeSubject.trim() || !welcomeBody.trim()) {
      setSendError('বাংলা ইমেইলের বিষয় ও বার্তা লিখুন।');
      return;
    }
    if (sendAlertCopy && (!alertSubject.trim() || !alertBody.trim())) {
      setSendError('অ্যাডমিনিস্ট্রেটর অ্যালার্টের বিষয় ও বার্তা লিখুন।');
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmedSend = async () => {
    if (!accessToken) {
      setConfirmOpen(false);
      return;
    }
    setSending(true);
    setSendError(null);
    const reports: DeliveryReportItem[] = [];

    try {
      await sendGmailMessage({
        accessToken,
        to: newAdminEmail.trim(),
        subject: welcomeSubject.trim(),
        body: welcomeBody.trim(),
      });
      reports.push({
        recipient: newAdminEmail.trim(),
        roleLabel: 'নতুন অ্যাডমিন (বাংলা কনফার্মেশন মেইল)',
        ok: true,
        message: 'সফলভাবে Gmail-এর মাধ্যমে পাঠানো হয়েছে।',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ইমেইল পাঠানো ব্যর্থ হয়েছে।';
      if (msg.includes('401') || msg.includes('403')) {
        onClearToken?.();
        setHasGmailScope(false);
      }
      reports.push({
        recipient: newAdminEmail.trim(),
        roleLabel: 'নতুন অ্যাডমিন (বাংলা কনফার্মেশন মেইল)',
        ok: false,
        message: msg,
      });
    }

    if (sendAlertCopy) {
      try {
        await sendGmailMessage({
          accessToken,
          to: administratorEmail.trim(),
          subject: alertSubject.trim(),
          body: alertBody.trim(),
        });
        reports.push({
          recipient: administratorEmail.trim(),
          roleLabel: 'অ্যাডমিনিস্ট্রেটর নোটিফিকেশন অ্যালার্ট',
          ok: true,
          message: 'সফলভাবে অ্যাডমিনিস্ট্রেটর ইমেইলে পাঠানো হয়েছে।',
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'অ্যালার্ট পাঠানো ব্যর্থ হয়েছে।';
        if (msg.includes('401') || msg.includes('403')) {
          onClearToken?.();
          setHasGmailScope(false);
        }
        reports.push({
          recipient: administratorEmail.trim(),
          roleLabel: 'অ্যাডমিনিস্ট্রেটর নোটিফিকেশন অ্যালার্ট',
          ok: false,
          message: msg,
        });
      }
    }

    setDeliveryReport(reports);
    setSending(false);
    setConfirmOpen(false);
  };

  const smsMessageText = `জননী টেলিকম: ${newAdminEmail.trim()} এখন ওয়েবসাইটের অনুমোদিত অ্যাডমিন হিসেবে যুক্ত হয়েছে। (${siteUrl})`;
  const cleanPhone = smsPhone.replace(/[^\d+]/g, '');
  const smsHref = cleanPhone
    ? `sms:${cleanPhone}?body=${encodeURIComponent(smsMessageText)}`
    : undefined;

  const confirmRecipientsSummary = sendAlertCopy
    ? `${newAdminEmail.trim()} (বাংলা অ্যাডমিন মেইল) এবং ${administratorEmail.trim()} (অ্যাডমিনিস্ট্রেটর অ্যালার্ট)`
    : newAdminEmail.trim();

  return (
    <div className="mt-6 space-y-6">
      {/* Authorized Admin Accounts List */}
      <div className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                অনুমোদিত অ্যাডমিন অ্যাকাউন্ট তালিকা
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                নিচের প্রতিটি গুগল অ্যাকাউন্ট সরাসরি Firestore এবং অ্যাডমিন
                প্যানেলের পূর্ণ অনুমতিপ্রাপ্ত।
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 self-start sm:self-auto">
            <UserCheck className="h-3.5 w-3.5" />
            <span>{BOOTSTRAPPED_ADMIN_EMAILS.length} জন সক্রিয় অ্যাডমিন</span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {BOOTSTRAPPED_ADMIN_EMAILS.map((email) => {
            const isPrimary = email === BOOTSTRAPPED_ADMIN_EMAIL;
            const isNewlyAdded = email === 'jononitelecom266366@gmail.com';
            return (
              <div
                key={email}
                className={`rounded-xl border p-4 ${
                  isNewlyAdded
                    ? 'border-sky-300 bg-sky-50/70'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    {isNewlyAdded ? (
                      <UserPlus className="h-3.5 w-3.5 text-sky-600" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    <span>
                      {isPrimary
                        ? 'প্রধান অ্যাডমিনিস্ট্রেটর'
                        : isNewlyAdded
                          ? 'নতুন অ্যাডমিন (যুক্ত)'
                          : 'অ্যাডমিন'}
                    </span>
                  </span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    সক্রিয়
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs font-semibold text-slate-800 break-all">
                  {email}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Google Sign-In দিয়ে লগইন করলেই ড্যাশবোর্ড খুলবে।
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bangla Email & Administrator Notification Composer */}
      <form
        onSubmit={handleOpenSendConfirm}
        className="card-3d rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                বাংলায় অ্যাডমিন ইমেইল ও অ্যাডমিনিস্ট্রেটর অ্যালার্ট পাঠান (Gmail)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                নতুন অ্যাডমিন ({newAdminEmail}) এবং অ্যাডমিনিস্ট্রেটর (
                {administratorEmail})-কে একসাথে Gmail-এর মাধ্যমে কনফার্মেশন
                বার্তা পাঠান।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleRegenerateTemplates(newAdminEmail)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
          >
            টেমপ্লেট রিসেট করুন
          </button>
        </div>

        {/* Gmail OAuth Connection Status */}
        {checkingScope ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <LoadingSpinner
              size="xs"
              label="Gmail পাঠানোর অনুমতি যাচাই করা হচ্ছে..."
            />
          </div>
        ) : !hasGmailScope ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-xs leading-relaxed text-amber-950">
              <span className="font-semibold">Gmail অনুমতি প্রয়োজন:</span>{' '}
              আপনার গুগল অ্যাকাউন্ট থেকে সরাসরি বাংলা ইমেইল ও অ্যাডমিনিস্ট্রেটর
              অ্যালার্ট পাঠাতে নিচের বাটনে ক্লিক করে Gmail ও Drive অনুমতি দিন।
            </p>
            {connectError && (
              <p className="text-xs font-medium text-red-700">{connectError}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <GoogleSignInButton
                onClick={handleConnectClick}
                disabled={connectingGoogle}
                label={
                  connectingGoogle
                    ? 'Gmail সংযুক্ত হচ্ছে...'
                    : 'Sign in with Google (Gmail অনুমতি দিন)'
                }
              />
              {connectingGoogle && (
                <LoadingSpinner size="sm" className="text-sky-600" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              Gmail প্রেরণ অনুমতি সক্রিয় আছে ({currentAdminEmail} থেকে পাঠানো
              যাবে)।
            </span>
          </div>
        )}

        {sendError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {sendError}
          </div>
        )}

        {deliveryReport.length > 0 && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-900">
              ইমেইল প্রেরণের ফলাফল:
            </p>
            {deliveryReport.map((item) => (
              <div
                key={`${item.recipient}-${item.roleLabel}`}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  item.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <p className="font-semibold">
                  {item.roleLabel} ({item.recipient})
                </p>
                <p className="mt-0.5">{item.message}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: New Admin Bangla Email */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">
                ১. নতুন অ্যাডমিনের বাংলা ইমেইল
              </h3>
              <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                বাংলা বার্তা
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                প্রাপক ইমেইল (নতুন অ্যাডমিন)
              </label>
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                ইমেইলের বিষয় (Subject)
              </label>
              <input
                type="text"
                value={welcomeSubject}
                onChange={(e) => setWelcomeSubject(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                বাংলা ইমেইল বার্তা
              </label>
              <textarea
                rows={10}
                value={welcomeBody}
                onChange={(e) => setWelcomeBody(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Right: Administrator Email Notification + Optional Phone SMS */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  ২. অ্যাডমিনিস্ট্রেটর ইমেইল নোটিফিকেশন
                </h3>
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendAlertCopy}
                    onChange={(e) => setSendAlertCopy(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                  />
                  <span>একসাথে পাঠান</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  অ্যাডমিনিস্ট্রেটর ইমেইল
                </label>
                <input
                  type="email"
                  value={administratorEmail}
                  onChange={(e) => setAdministratorEmail(e.target.value)}
                  disabled={!sendAlertCopy}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  অ্যালার্ট বিষয় (Subject)
                </label>
                <input
                  type="text"
                  value={alertSubject}
                  onChange={(e) => setAlertSubject(e.target.value)}
                  disabled={!sendAlertCopy}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  অ্যাডমিনিস্ট্রেটর নোটিফিকেশন বার্তা
                </label>
                <textarea
                  rows={6}
                  value={alertBody}
                  onChange={(e) => setAlertBody(e.target.value)}
                  disabled={!sendAlertCopy}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-sky-600 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Optional Phone SMS Launcher */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  মোবাইল SMS নোটিশ (ঐচ্ছিক)
                </h3>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                সরাসরি ফোনে SMS পাঠাতে চাইলে নিচের নম্বর থেকে আপনার ডিভাইসের
                SMS অ্যাপ খুলতে পারেন (ব্রাউজার থেকে স্বয়ংক্রিয়ভাবে মোবাইল
                সিম SMS পাঠানো যায় না, তবে Gmail ইমেইল সরাসরি পাঠানো হয়):
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="tel"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="01738266366"
                  className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                />
                {smsHref && (
                  <a
                    href={smsHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>মোবাইল SMS অ্যাপে পাঠান</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={sending || !hasGmailScope}
            className="btn-3d-primary inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>
              {sendAlertCopy
                ? 'দুটি ইমেইলই পাঠান (Gmail)'
                : 'বাংলা ইমেইল পাঠান (Gmail)'}
            </span>
          </button>
        </div>
      </form>

      {/* Mandatory Confirmation Dialog before sending emails via Gmail API */}
      <ConfirmDialog
        open={confirmOpen}
        title="Gmail-এর মাধ্যমে ইমেইল পাঠাবেন?"
        description={`আপনি কি নিশ্চিত যে ${confirmRecipientsSummary} ঠিকানায় বাংলা অ্যাডমিন কনফার্মেশন ইমেইল পাঠাতে চান? প্রেরক অ্যাকাউন্ট: ${currentAdminEmail}`}
        confirmLabel="হ্যাঁ, ইমেইল পাঠান"
        variant="primary"
        busy={sending}
        onConfirm={handleConfirmedSend}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
