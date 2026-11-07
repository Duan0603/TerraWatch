import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

// Ảnh báo cáo hiện trường cần đăng nhập (Story 4.9): <img src> không gửi được Authorization,
// nên tải ảnh bằng axios (có token) rồi hiển thị qua blob URL.
export default function AuthImage({ path, alt, style, onError }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    setSrc(null);
    if (!path) return undefined;
    // path là đường dẫn máy chủ trả về (/api/v1/...), axiosClient đã có sẵn tiền tố /api/v1.
    axiosClient.get(path.replace(/^\/api\/v1/, ''), { responseType: 'blob' })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((err) => { if (!cancelled && onError) onError(err); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!src) return null;
  return <img src={src} alt={alt} style={style} />;
}
