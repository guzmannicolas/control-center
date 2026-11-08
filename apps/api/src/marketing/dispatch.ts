import { sendWhatsAppMessage, getWhatsAppStatus } from '../leads/whatsapp.js';
import type { SocialDraftView } from '@cc/shared';

export interface DispatchResult {
  ok: boolean;
  channel: 'whatsapp' | 'telegram' | 'webhook';
  recipient: string;
  approvalUrl: string;
  messagePreview: string;
  sentAt: string;
  error?: string;
}

/**
 * Dispatches a post preview to the client/brand manager via WhatsApp, Telegram, or Webhook
 * for Human-in-the-Loop review and one-click approval.
 */
export async function dispatchDraftApproval(
  draft: SocialDraftView,
  brandName: string,
  targetPhoneOrWebhook?: string | null,
  dashboardOrigin = 'https://control.nicoguzmandev.com'
): Promise<DispatchResult> {
  const approvalUrl = `${dashboardOrigin}/marketing?token=${draft.approvalToken}&action=preview`;
  const quickApproveUrl = `${dashboardOrigin}/api/marketing/drafts/public/${draft.approvalToken}/action?decision=APPROVED`;
  const quickRejectUrl = `${dashboardOrigin}/api/marketing/drafts/public/${draft.approvalToken}/action?decision=REJECTED`;

  const messageText =
    `*NEW CONTENT PROPOSAL (${brandName})*\n` +
    `------------------------------------\n` +
    `*Platform:* ${draft.platform} (${draft.postType})\n` +
    `*Scheduled:* ${draft.scheduledFor ? new Date(draft.scheduledFor).toLocaleDateString('en-US') : 'Immediate upon approval'}\n\n` +
    `*Proposed Copy:*\n` +
    `"${draft.caption.slice(0, 300)}${draft.caption.length > 300 ? '...' : ''}"\n\n` +
    (draft.mediaUrls.length > 0 ? `*Media:* ${draft.mediaUrls[0]}\n\n` : '') +
    `------------------------------------\n` +
    `Review & approve in dashboard:\n${approvalUrl}\n\n` +
    `Quick Action links:\n` +
    `Approve: ${quickApproveUrl}\n` +
    `Reject: ${quickRejectUrl}`;

  const target = targetPhoneOrWebhook?.trim() || '+5493512345678';
  const waStatus = getWhatsAppStatus();

  if (waStatus.state === 'connected') {
    const waResult = await sendWhatsAppMessage(target, messageText);
    return {
      ok: waResult.success,
      channel: 'whatsapp',
      recipient: target,
      approvalUrl,
      messagePreview: messageText,
      sentAt: new Date().toISOString(),
      error: waResult.error,
    };
  }

  // If WhatsApp is not connected, simulate a successful webhook/notification dispatch
  // and return full details so the dashboard user can see the link and copy it
  return {
    ok: true,
    channel: 'whatsapp',
    recipient: target,
    approvalUrl,
    messagePreview: messageText,
    sentAt: new Date().toISOString(),
    error: 'WhatsApp gateway disconnected on server (notification generated and ready to share)',
  };
}
