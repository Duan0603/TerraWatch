---
name: ponytail-review
description: Review mã nguồn chuyên biệt về chống over-engineering, chỉ ra đoạn code nào nên xóa hoặc thay thế bằng thư viện chuẩn.
---

# Ponytail Review Workflow

Review mã nguồn tập trung vào việc loại bỏ sự phức tạp thừa thãi:
- Tìm các đoạn code tự chế lại những gì thư viện chuẩn / CSDL đã có sẵn.
- Phát hiện các interface chỉ có 1 class implement, các lớp abstraction không cần thiết.
- Đưa ra định dạng: Vị trí (Location) - Cần cắt bỏ cái gì (What to cut) - Thay thế bằng cái gì (What replaces it).
