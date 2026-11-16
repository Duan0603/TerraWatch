// Story 4.42: who a broadcast reaches. Push needs a registered device; SMS needs a subscriber with SMS on and a phone
// (core-api preview: subscribers, devices, smsSubscribers). Either channel is enough to send.
export function broadcastReach(preview) {
  if (!preview) return null;
  const devices = preview.devices || 0;
  const sms = preview.smsSubscribers || 0;
  const parts = [devices > 0 && `${devices} thiết bị nhận Push`, sms > 0 && `${sms} người nhận SMS`].filter(Boolean);
  return {
    canSend: devices > 0 || sms > 0,
    channels: [devices > 0 && 'FCM APP PUSH', sms > 0 && 'SMS'].filter(Boolean),
    summary: `Người nhận dự kiến: ${preview.subscribers || 0} người đăng ký Push, ${devices} thiết bị; ${sms} người nhận SMS.`,
    sendText: parts.length ? `Sẽ gửi tới ${parts.join(' và ')}.` : 'Khu vực này chưa có ai nhận cảnh báo (không có thiết bị Push, không có người đăng ký SMS). Không thể phát lệnh.'
  };
}

/** One line for the result screen: how many pushes and SMS actually went out (core-api send response). */
export function sendResultText(r) {
  const push = r.total > 0
    ? `Thông báo app: ${r.sent}/${r.total} thiết bị${r.failed > 0 ? ` (${r.failed} lỗi)` : ''}`
    : 'Thông báo app: không có thiết bị';
  const sms = r.smsRecipients > 0
    ? `SMS: ${r.smsSent}/${r.smsRecipients} tin${r.smsFailed > 0 ? ` (${r.smsFailed} lỗi${r.smsError ? `: ${r.smsError}` : ''})` : ''}`
    : 'SMS: không có người đăng ký';
  return `${push}. ${sms}.`;
}
