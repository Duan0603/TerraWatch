// Chuyển lỗi của /auth/register và /auth/officer-requests thành câu tiếng Việt dễ hiểu.
// Hàm thuần (không import axios) để test được bằng node.
export function registerErrorMessage(err) {
  const status = err?.response?.status;
  const serverMessage = err?.response?.data?.message;
  if (status === 409) return 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.';
  if (status === 400 && /phone number must be verified|verification token|phone token/i.test(serverMessage || '')) {
    return 'Số điện thoại chưa được xác minh bằng mã OTP. Vui lòng gửi lại mã và nhập đúng.';
  }
  if (status === 400) return serverMessage || 'Thông tin đăng ký chưa hợp lệ.';
  if (!err?.response) return 'Không kết nối được máy chủ. Vui lòng thử lại sau.';
  return `Đăng ký không thành công (mã lỗi ${status}).`;
}
