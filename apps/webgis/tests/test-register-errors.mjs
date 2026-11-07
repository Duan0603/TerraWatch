import assert from 'node:assert/strict';
import { registerErrorMessage, resetErrorMessage } from '../src/api/registerError.js';

// Story 4.7/4.8: lỗi đăng ký phải là câu tiếng Việt rõ ràng, không phải "Request failed with status code 409".
export async function testRegisterErrors() {
  console.log('\n▶ testRegisterErrors');
  const http = (status, message) => ({ response: { status, data: message ? { message } : {} } });

  assert.match(registerErrorMessage(http(409, 'Email already exists')), /Email này đã được đăng ký/);
  console.log('  ✓ 409 = email đã đăng ký');

  assert.match(registerErrorMessage(http(400, 'Phone number must be verified via OTP before registration')), /chưa được xác minh bằng mã OTP/);
  assert.match(registerErrorMessage(http(400, 'Invalid phone token')), /chưa được xác minh bằng mã OTP/);
  console.log('  ✓ 400 do thiếu/sai OTP');

  assert.equal(registerErrorMessage(http(400, 'Password exceeds 72 UTF-8 bytes')), 'Password exceeds 72 UTF-8 bytes');
  assert.match(registerErrorMessage(http(400)), /chưa hợp lệ/);
  console.log('  ✓ 400 khác giữ thông điệp máy chủ hoặc câu mặc định');

  assert.match(registerErrorMessage(new Error('Network Error')), /Không kết nối được máy chủ/);
  assert.match(registerErrorMessage(http(500)), /mã lỗi 500/);
  console.log('  ✓ mất mạng và lỗi 5xx');
  // Quên mật khẩu bằng email: câu tiếng Việt của máy chủ cho 400/503, câu cố định cho mất mạng.
  assert.equal(resetErrorMessage(http(400, 'Mã xác nhận không đúng hoặc đã hết hạn')), 'Mã xác nhận không đúng hoặc đã hết hạn');
  assert.match(resetErrorMessage(http(503, 'Máy chủ chưa cấu hình gửi email.')), /chưa cấu hình gửi email/);
  assert.match(resetErrorMessage(http(400)), /chưa hợp lệ/);
  assert.match(resetErrorMessage(new Error('Network Error')), /Không kết nối được máy chủ/);
  console.log('  ✓ lỗi quên mật khẩu bằng email');
  console.log('✅ testRegisterErrors PASSED!');
}
