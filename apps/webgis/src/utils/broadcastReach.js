// Story 4.42: who a broadcast reaches. Push needs a registered device; SMS needs a subscriber with SMS on and a phone
// (core-api preview: subscribers, devices, smsSubscribers). App subscribers also see the alert in their web/app inbox,
// so any of the three is enough to send.
export function broadcastReach(preview) {
  if (!preview) return null;
  const subscribers = preview.subscribers || 0;
  const devices = preview.devices || 0;
  const sms = preview.smsSubscribers || 0;
  const parts = [devices > 0 && `${devices} thiết bị nhận Push`, sms > 0 && `${sms} người nhận SMS`].filter(Boolean);
  const channels = [devices > 0 && 'FCM APP PUSH', sms > 0 && 'SMS'].filter(Boolean);
  return {
    canSend: devices > 0 || sms > 0 || subscribers > 0,
    channels: channels.length || !subscribers ? channels : ['THÔNG BÁO TRÊN WEB / APP'],
    summary: `Người nhận dự kiến: ${subscribers} người đăng ký Push, ${devices} thiết bị; ${sms} người nhận SMS.`,
    sendText: parts.length ? `Sẽ gửi tới ${parts.join(' và ')}.`
      : subscribers ? `Sẽ hiện trên trang web/app của ${subscribers} người đã đăng ký (chưa có điện thoại nhận Push).`
      : 'Khu vực này chưa có ai nhận cảnh báo (không có người đăng ký, không có thiết bị Push, không có người đăng ký SMS). Không thể phát lệnh.'
  };
}

/** One line for the result screen: how many pushes and SMS actually went out (core-api send response). */
export function sendResultText(r) {
  const web = r.appSubscribers > 0 ? `Trang web/app: ${r.appSubscribers} người đăng ký. ` : '';
  const push = r.total > 0
    ? `Thông báo app: ${r.sent}/${r.total} thiết bị${r.failed > 0 ? ` (${r.failed} lỗi)` : ''}`
    : 'Thông báo app: không có thiết bị';
  const sms = r.smsRecipients > 0
    ? `SMS: ${r.smsSent}/${r.smsRecipients} tin${r.smsFailed > 0 ? ` (${r.smsFailed} lỗi${r.smsError ? `: ${r.smsError}` : ''})` : ''}`
    : 'SMS: không có người đăng ký';
  return `${web}${push}. ${sms}.`;
}
