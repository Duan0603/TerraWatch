import React from 'react';
import { CheckCircle2 } from 'lucide-react';

// Thanh tiến trình 3 bước dùng chung cho hộp đăng ký và hộp quên mật khẩu.
export default function FormSteps({ current, labels = ['Thông tin', 'Xác minh SĐT', 'Hoàn tất'], ariaLabel = 'Các bước' }) {
  return (
    <ol className="lg-steps" aria-label={ariaLabel}>
      {labels.map((label, i) => {
        const state = i + 1 < current ? 'done' : i + 1 === current ? 'now' : 'todo';
        return (
          <li key={label} className={`lg-step lg-step-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="lg-step-dot">{state === 'done' ? <CheckCircle2 size={16} aria-hidden="true" /> : i + 1}</span>
            <span className="lg-step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
