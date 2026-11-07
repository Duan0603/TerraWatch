import assert from 'node:assert/strict';
import { registerErrorMessage } from '../src/api/registerError.js';

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
  console.log('✅ testRegisterErrors PASSED!');
}
