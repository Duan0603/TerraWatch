import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_geosentry_deck(output_path):
    prs = Presentation()
    # 16:9 widescreen
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6] # completely blank layout

    # Palette
    BG_COLOR = RGBColor(11, 15, 25)         # Deep Navy #0B0F19
    CARD_BG = RGBColor(21, 30, 50)          # Card navy #151E32
    CARD_BORDER = RGBColor(42, 59, 92)      # #2A3B5C
    TEXT_WHITE = RGBColor(255, 255, 255)
    TEXT_MUTED = RGBColor(148, 163, 184)    # #94A3B8
    CYAN_ACCENT = RGBColor(14, 165, 233)    # #0EA5E9
    ORANGE_ACCENT = RGBColor(249, 115, 22)  # #F97316
    GREEN_ACCENT = RGBColor(16, 185, 129)   # #10B981
    RED_ACCENT = RGBColor(239, 68, 68)      # #EF4444

    def add_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, category_text="GEOSENTRY (TERRAWATCH) • SOFTWARE ENGINEERING CAPSTONE"):
        # Category badge
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.5), Inches(0.4))
        tf = cat_box.text_frame
        tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = tf.margin_left = tf.margin_right = 0
        p = tf.paragraphs[0]
        p.text = category_text.upper()
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = CYAN_ACCENT

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.5), Inches(0.7))
        tf = title_box.text_frame
        tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = tf.margin_left = tf.margin_right = 0
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.size = Pt(22)
        p.font.bold = True
        p.font.color.rgb = TEXT_WHITE

    def add_card(slide, left, top, width, height, title, body_bullets, accent_color=CYAN_ACCENT, subtitle=None):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER
        card.line.width = Pt(1.2)

        # Card content
        tb = slide.shapes.add_textbox(left + Inches(0.2), top + Inches(0.2), width - Inches(0.4), height - Inches(0.4))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = tf.margin_left = tf.margin_right = 0

        # Title
        p_title = tf.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(14)
        p_title.font.bold = True
        p_title.font.color.rgb = accent_color

        if subtitle:
            p_sub = tf.add_paragraph()
            p_sub.text = subtitle
            p_sub.font.size = Pt(10)
            p_sub.font.italic = True
            p_sub.font.color.rgb = TEXT_MUTED
            p_sub.space_after = Pt(6)

        for b in body_bullets:
            p_b = tf.add_paragraph()
            p_b.text = f"•  {b}"
            p_b.font.size = Pt(10.5)
            p_b.font.color.rgb = TEXT_WHITE
            p_b.space_after = Pt(4)

    # -------------------------------------------------------------------------
    # SLIDE 1: COVER
    # -------------------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    add_slide_background(s1)

    # Hero Badge
    badge = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.1), Inches(4.5), Inches(0.45))
    badge.fill.solid()
    badge.fill.fore_color.rgb = RGBColor(14, 45, 75)
    badge.line.color.rgb = CYAN_ACCENT
    badge.line.width = Pt(1)
    tf = badge.text_frame
    p = tf.paragraphs[0]
    p.text = "🛰️ SOFTWARE ENGINEERING CAPSTONE PROJECT"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = CYAN_ACCENT
    p.alignment = PP_ALIGN.CENTER

    # Main Title
    tb = s1.shapes.add_textbox(Inches(0.8), Inches(1.7), Inches(11.5), Inches(1.8))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "GEOSENTRY (TERRAWATCH)"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE

    p2 = tf.add_paragraph()
    p2.text = "Hệ Thống Viễn Thám, Trí Tuệ Nhân Tạo & Mô Hình 3D\nCảnh Báo Sớm và Hỗ Trợ Điều Phối Cứu Hộ Sạt Lở Đất Miền Núi"
    p2.font.size = Pt(18)
    p2.font.color.rgb = CYAN_ACCENT
    p2.space_before = Pt(8)

    # Team Members Box
    t_box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.2), Inches(11.7), Inches(2.2))
    t_box.fill.solid()
    t_box.fill.fore_color.rgb = CARD_BG
    t_box.line.color.rgb = CARD_BORDER

    tf_team = t_box.text_frame
    tf_team.margin_top = Inches(0.2)
    tf_team.margin_left = Inches(0.4)
    p_h = tf_team.paragraphs[0]
    p_h.text = "NHÓM SINH VIÊN THỰC HIỆN ĐỀ TÀI (5 THÀNH VIÊN WBS):"
    p_h.font.size = Pt(12)
    p_h.font.bold = True
    p_h.font.color.rgb = ORANGE_ACCENT

    members = [
        "1. Duẫn — AI / Computer Vision Engineer (Model DeepLabV3+ ONNX, Tensor 8 kênh, AI Rescue Route)",
        "2. Tú — GIS Pipeline & Data Engineer (Sentinel-2 Crawl, Cloud Masking, NDVI, DEM Slope, PostGIS)",
        "3. Thuận — Backend Engineer & System Architect (Spring Boot 3, JWT 4 Roles, Redis Bus, Gateway)",
        "4. Huy — Frontend WebGIS Engineer (React 18 / Next.js, Mapbox 3D Terrain, 3D Rescue Map, Time-slider)",
        "5. Lâm — Mobile App Engineer (Flutter 3.x, SQLite Offline 10,000 đa giác, Geofencing Hú Còi, 1-Tap SOS)"
    ]
    for m in members:
        p_m = tf_team.add_paragraph()
        p_m.text = m
        p_m.font.size = Pt(10.5)
        p_m.font.color.rgb = TEXT_WHITE
        p_m.space_before = Pt(2)

    # -------------------------------------------------------------------------
    # SLIDE 2: PROBLEM STATEMENT
    # -------------------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    add_slide_background(s2)
    add_header(s2, "TÍNH CẤP THIẾT & 4 ĐIỂM NGHẼN TRONG CỨU HỘ SẠT LỞ")

    card_w = Inches(2.7)
    card_h = Inches(4.8)
    top_pos = Inches(1.8)

    add_card(s2, Inches(0.8), top_pos, card_w, card_h, "1. Phát Hiện Chậm Trễ", [
        "Sạt lở xảy ra bất ngờ sau mưa dầm kéo dài tại vùng núi hiểm trở.",
        "Điển hình: Vụ sạt lở Làng Nủ (Lào Cai) sau bão Yagi 2024.",
        "Hiện tại chỉ phát hiện khi thảm họa đã ập xuống hoặc có người sống sót chạy bộ về báo xã.",
        "Thiếu cơ chế cảnh báo vĩ mô tự động trên diện rộng."
    ], RED_ACCENT, "Phụ thuộc báo tin thủ công")

    add_card(s2, Inches(3.8), top_pos, card_w, card_h, "2. Mất Sóng Viễn Thông", [
        "Mưa bão quật đổ cột BTS, sạt đường đứt cáp quang.",
        "Các bản làng bị cô lập mất sạch 100% sóng 4G/Internet.",
        "Người dân không thể nhận tin nhắn SMS hay thông báo đẩy online.",
        "Ứng dụng cảnh báo thông thường trở nên vô dụng khi mất mạng."
    ], ORANGE_ACCENT, "Cô lập hoàn toàn kết nối")

    add_card(s2, Inches(6.8), top_pos, card_w, card_h, "3. Bản Đồ 2D Thiếu Trực Quan", [
        "Bản đồ 2D phẳng không thể hiện được độ dốc sườn núi hiểm trở.",
        "Không quan sát được vết trượt bùn đất đang lan rộng theo hướng nào.",
        "Không định vị được không gian 3 chiều giữa vị trí nạn nhân và chướng ngại vật.",
        "Chỉ huy cứu hộ gặp khó khăn khi đánh giá hiện trường."
    ], CYAN_ACCENT, "Hạn chế của bản đồ phẳng")

    add_card(s2, Inches(9.8), top_pos, card_w, card_h, "4. Đội Cứu Hộ Thiếu Lộ Trình", [
        "Đội cứu hộ di chuyển vào vùng thiên tai thường gặp đèo sụt lún.",
        "Không biết cung đường nào bị đất đá vùi lấp, đường nào an toàn.",
        "Nguy cơ xe cứu nạn bị mắc kẹt hoặc gặp sạt trượt thứ cấp.",
        "Thiếu thuật toán AI đề xuất tuyến đường né tránh vùng nguy hiểm."
    ], GREEN_ACCENT, "Nguy cơ đe dọa người cứu hộ")

    # -------------------------------------------------------------------------
    # SLIDE 3: THE SOLUTION
    # -------------------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    add_slide_background(s3)
    add_header(s3, "GIẢI PHÁP GEOSENTRY: HỆ SINH THÁI CẢNH BÁO & CỨU HỘ ĐỒNG BỘ")

    card_w2 = Inches(5.6)
    card_h2 = Inches(2.3)

    add_card(s3, Inches(0.8), Inches(1.8), card_w2, card_h2, "🛰️ Tầng Viễn Thám Vĩ Mô (Sentinel-2 + DEM)", [
        "Vệ tinh quét diện rộng không cần thiết bị hiện trường.",
        "Lọc mây thông minh và tính chỉ số suy giảm thảm phủ Delta-NDVI.",
        "Trích xuất độ dốc sườn đồi từ ảnh số độ cao SRTM 30m DEM."
    ], CYAN_ACCENT)

    add_card(s3, Inches(6.9), Inches(1.8), card_w2, card_h2, "🧠 Tầng Phân Tích AI & Đề Xuất Cứu Hộ", [
        "DeepLabV3+ ONNX nhận diện đa giác vết trượt sạt lở (F1 = 0.768).",
        "Tự động vector hóa ra chuẩn PostGIS MultiPolygon GeoJSON.",
        "Thuật toán AI A* tính tuyến đường xe cứu hộ né tránh vùng nguy hiểm."
    ], GREEN_ACCENT)

    add_card(s3, Inches(0.8), Inches(4.5), card_w2, card_h2, "🖥️ Tầng Chỉ Huy 3D (WebGIS Command Center)", [
        "Bản đồ địa hình Mapbox 3D Terrain sườn núi sống động.",
        "Mô hình 3D Hiện trường: Danger Zone, Victim, Hazard, Rescue Route.",
        "Thanh trượt đối soát ảnh trước/sau và hàng đợi duyệt sạt lở 1-click."
    ], ORANGE_ACCENT)

    add_card(s3, Inches(6.9), Inches(4.5), card_w2, card_h2, "📱 Tầng Ngoại Tuyến Hiện Trường (Mobile Citizen App)", [
        "Cơ chế Geofencing Ngoại tuyến: SQLite lưu 10,000 đa giác sạt lở.",
        "Rung chuông còi hú báo động âm lượng tối đa ngay khi mất sóng 4G.",
        "Nút SOS khẩn cấp 1-chạm gửi GPS và Live Rescue Tracking."
    ], RED_ACCENT)

    # -------------------------------------------------------------------------
    # SLIDE 4: ARCHITECTURE (8 COMPONENTS)
    # -------------------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    add_slide_background(s4)
    add_header(s4, "KIẾN TRÚC MICROSERVICES 8 THÀNH PHẦN CỐT LÕI")

    grid_w = Inches(2.7)
    grid_h = Inches(2.3)

    add_card(s4, Inches(0.8), Inches(1.8), grid_w, grid_h, "1. Clients", [
        "WebGIS React 18 + Mapbox GL",
        "Mobile App Flutter 3.x + SQLite",
        "Thiết kế Responsive & Dark Theme"
    ], CYAN_ACCENT)

    add_card(s4, Inches(3.8), Inches(1.8), grid_w, grid_h, "2. API Gateway", [
        "Nginx Reverse Proxy (Port 8080)",
        "Rate Limiting 50 req/s",
        "Global CORS & Gzip Compression"
    ], CYAN_ACCENT)

    add_card(s4, Inches(6.8), Inches(1.8), grid_w, grid_h, "3. Core API Service", [
        "Java 17 + Spring Boot 3",
        "Spring Security 6 + JWT RBAC",
        "Quản lý sự cố & Audit Trail"
    ], GREEN_ACCENT)

    add_card(s4, Inches(9.8), Inches(1.8), grid_w, grid_h, "4. AI & GIS Services", [
        "AI: FastAPI + ONNX Runtime",
        "GIS: FastAPI + GDAL/Rasterio",
        "Tách biệt Bounded Context"
    ], GREEN_ACCENT)

    add_card(s4, Inches(0.8), Inches(4.5), grid_w, grid_h, "5. PostGIS Database", [
        "PostgreSQL 15 + PostGIS 3.3",
        "Logical Schema-per-Service",
        "core_schema & gis_schema GiST"
    ], ORANGE_ACCENT)

    add_card(s4, Inches(3.8), Inches(4.5), grid_w, grid_h, "6. Message Broker", [
        "Redis 7 Alpine Pub/Sub",
        "Channel: terrawatch:events",
        "Xử lý bất đồng bộ đa service"
    ], ORANGE_ACCENT)

    add_card(s4, Inches(6.8), Inches(4.5), grid_w, grid_h, "7. Fault Tolerance", [
        "Resilience4j Circuit Breaker",
        "Ngắt mạch khi AI/GIS lỗi >= 50%",
        "Fallback queue, Core API không sập"
    ], RED_ACCENT)

    add_card(s4, Inches(9.8), Inches(4.5), grid_w, grid_h, "8. Orchestration", [
        "Docker Compose 7 Services",
        "Internal DNS: terrawatch-net",
        "CI/CD GitHub Actions theo path"
    ], RED_ACCENT)

    # -------------------------------------------------------------------------
    # SLIDE 5: TU (GIS PIPELINE)
    # -------------------------------------------------------------------------
    s5 = prs.slides.add_slide(blank_layout)
    add_slide_background(s5)
    add_header(s5, "PHÂN HỆ GIS PIPELINE & VIỄN THÁM (TÚ PHỤ TRÁCH)", "THÀNH VIÊN 2 • GIS PIPELINE & DATA ENGINEER")

    c_w = Inches(3.7)
    c_h = Inches(4.8)

    add_card(s5, Inches(0.8), Inches(1.8), c_w, c_h, "Thu Thập & Lọc Mây Vệ Tinh", [
        "Tự động crawl ảnh Sentinel-2 L2A qua Copernicus CDSE / Sentinel Hub API.",
        "Áp dụng thuật toán lọc mây thông minh dựa trên Scene Classification Layer (SCL / s2cloudless).",
        "Tự động loại bỏ các khung cảnh bị mây che phủ > 40%.",
        "Lưu trữ siêu dữ liệu cảnh chụp vào gis_schema.satellite_scenes."
    ], CYAN_ACCENT, "Copernicus API & Cloud Masking")

    add_card(s5, Inches(4.8), Inches(1.8), c_w, c_h, "Tính Toán Chỉ Số Địa Không Gian", [
        "Tính toán biến động thực vật Delta-NDVI giữa cảnh trước và sau thiên tai bằng rasterio.",
        "Trích xuất góc dốc địa hình sườn núi [0 - 90 độ] từ ảnh số độ cao SRTM 30m DEM.",
        "Chuẩn hóa và đồng bộ hệ quy chiếu tọa độ địa lý WGS84 EPSG:4326.",
        "Chuẩn bị ma trận 8 kênh hoàn chỉnh bàn giao cho phân hệ AI."
    ], GREEN_ACCENT, "Delta-NDVI & SRTM 30m DEM Slope")

    add_card(s5, Inches(8.8), Inches(1.8), c_w, c_h, "Tiling & Raster-to-Vector", [
        "Module Tiling băm lưới khu vực giám sát AOI thành các patch 128x128 pixel.",
        "Băm lưới thông minh tính toán độ nén kinh độ theo vĩ độ và độ gối mép (stride overlap).",
        "Thuật toán Raster-to-Vector (Polygonization) chuyển mặt nạ AI thành đa giác PostGIS MultiPolygon.",
        "Phục vụ Vector Tiles MVT qua /tiles/{z}/{x}/{y}.pbf cho WebGIS."
    ], ORANGE_ACCENT, "Tiling Engine & Vector Tiles")

    # -------------------------------------------------------------------------
    # SLIDE 6: DUAN (AI / CV)
    # -------------------------------------------------------------------------
    s6 = prs.slides.add_slide(blank_layout)
    add_slide_background(s6)
    add_header(s6, "PHÂN HỆ TRÍ TUỆ NHÂN TẠO & HỌC SÂU (DUẪN PHỤ TRÁCH)", "THÀNH VIÊN 1 • AI / COMPUTER VISION ENGINEER")

    # Metrics row
    m_box = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(11.7), Inches(0.9))
    m_box.fill.solid()
    m_box.fill.fore_color.rgb = CARD_BG
    m_box.line.color.rgb = CYAN_ACCENT
    tf_m = m_box.text_frame
    p = tf_m.paragraphs[0]
    p.text = "CHỈ SỐ ĐÁNH GIÁ MÔ HÌNH:   F1-Score: 0.768   |   IoU: 0.642   |   Độ trễ: < 300ms   |   Đầu vào: Tensor 8 dải phổ"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = CYAN_ACCENT
    p.alignment = PP_ALIGN.CENTER

    add_card(s6, Inches(0.8), Inches(2.9), c_w, Inches(3.9), "Semantic Segmentation Sạt Lở", [
        "Kiến trúc DeepLabV3+ với Backbone ResNet-50 / EfficientNet kết hợp ASPP.",
        "Huấn luyện trên tập dữ liệu chuẩn quốc tế Landslide4Sense (> 3,799 mẫu).",
        "Đầu vào 8 kênh: [B2, B3, B4, B8, B11, B12, NDVI, SLOPE].",
        "Hàm mất mát Focal + Dice Loss giải quyết mất cân bằng mẫu nghiêm trọng (< 2% diện tích sạt lở)."
    ], CYAN_ACCENT, "DeepLabV3+ on Landslide4Sense")

    add_card(s6, Inches(4.8), Inches(2.9), c_w, Inches(3.9), "Đóng Gói ONNX Runtime", [
        "Xuất mô hình PyTorch sang định dạng ONNX Runtime tối ưu.",
        "Tốc độ suy luận CPU Intel chỉ 182ms, GPU RTX 3060 đạt 26ms/patch.",
        "Triển khai qua FastAPI service độc lập tại port 8001.",
        "Hỗ trợ chế độ chạy nền tự động xử lý hàng loạt khi có ảnh vệ tinh mới."
    ], GREEN_ACCENT, "High Performance Inference")

    add_card(s6, Inches(8.8), Inches(2.9), c_w, Inches(3.9), "Thuật Toán AI Rescue Route", [
        "Thuật toán tìm đường tối ưu (A* / Dijkstra) trên đồ thị OpenStreetMap qua osmnx.",
        "Tự động áp trọng số phạt cực lớn cho các cung đường cắt qua đa giác Danger Zone.",
        "Đề xuất tuyến đường an toàn nhất cho xe cứu hộ tiếp cận bản làng bị cô lập.",
        "Xuất kết quả GeoJSON LineString hiển thị trực quan lên bản đồ 3D."
    ], ORANGE_ACCENT, "A* Obstacle Avoidance Routing")

    # -------------------------------------------------------------------------
    # SLIDE 7: THUAN (BACKEND)
    # -------------------------------------------------------------------------
    s7 = prs.slides.add_slide(blank_layout)
    add_slide_background(s7)
    add_header(s7, "PHÂN HỆ BACKEND, SECURITY & EVENT BUS (THUẬN PHỤ TRÁCH)", "THÀNH VIÊN 3 • BACKEND ENGINEER & ARCHITECT")

    add_card(s7, Inches(0.8), Inches(1.8), c_w, c_h, "Core API & Bảo Mật RBAC JWT", [
        "Phát triển trên nền tảng Java 17 + Spring Boot 3 công nghiệp.",
        "Bảo mật Spring Security 6 với JWT Token phi trạng thái (Stateless).",
        "Phân quyền RBAC 4 nhóm đối tượng: citizen, rescue_team, officer, admin.",
        "Băm mật khẩu bằng BCrypt; endpoint /api/v1/auth/** phục vụ đăng ký, đăng nhập an toàn."
    ], CYAN_ACCENT, "Spring Boot 3 & Security 6")

    add_card(s7, Inches(4.8), Inches(1.8), c_w, c_h, "Resilience4j Circuit Breaker", [
        "Bọc các kết nối gọi liên service sang AI và GIS bằng Circuit Breaker.",
        "Cấu hình tự động chuyển sang OPEN khi tỷ lệ lỗi vượt quá 50% trong 10 calls.",
        "Kích hoạt phương thức Fallback lưu request vào hàng đợi xử lý ngầm.",
        "Core API được bảo vệ tuyệt đối, không bao giờ bị sập lan truyền (Cascading Failures)."
    ], RED_ACCENT, "Chống sập lan truyền")

    add_card(s7, Inches(8.8), Inches(1.8), c_w, c_h, "Event Bus & Audit Trail", [
        "Message Broker Redis 7 Pub/Sub đồng bộ bất đồng bộ qua channel terrawatch:events.",
        "Tích hợp Firebase Cloud Messaging (FCM) phát thông báo đẩy khẩn cấp.",
        "Lưu vết kiểm toán bất biến (Audit Trail) trong bảng landslide_event_history.",
        "Quản trị hạ tầng Docker Compose 7 container và Gateway Nginx."
    ], GREEN_ACCENT, "Redis Pub/Sub & FCM Push")

    # -------------------------------------------------------------------------
    # SLIDE 8: HUY (WEBGIS 3D)
    # -------------------------------------------------------------------------
    s8 = prs.slides.add_slide(blank_layout)
    add_slide_background(s8)
    add_header(s8, "PHÂN HỆ WEBGIS COMMAND CENTER & MÔ HÌNH 3D (HUY PHỤ TRÁCH)", "THÀNH VIÊN 4 • FRONTEND WEBGIS ENGINEER")

    add_card(s8, Inches(0.8), Inches(1.8), c_w, c_h, "Mapbox GL 3D Terrain", [
        "Phát triển bằng React 18 / Next.js kết hợp Tailwind CSS.",
        "Bật lớp bản đồ địa hình 3D (Terrain 3D Elevation) trên nền WebGL.",
        "Mô phỏng chân thực độ dốc núi rừng hiểm trở các tỉnh Yên Bái, Lào Cai.",
        "Cho phép cán bộ nghiêng, xoay camera 3D 360 độ để quan sát vết nứt sườn đồi."
    ], CYAN_ACCENT, "Địa hình 3D sườn núi chân thực")

    add_card(s8, Inches(4.8), Inches(1.8), c_w, c_h, "Mô Hình 3D Hiện Trường Cứu Hộ", [
        "Trực quan hóa không gian hiện trường với 4 lớp marker trực quan:",
        "🔴 Danger Zone: Đa giác bùn đất sạt lở 3D phủ trên mặt đất.",
        "🟢 Victim: Điểm ghim vị trí người dân gửi SOS kêu cứu từ hiện trường.",
        "⚠ Hazard: Các điểm sạt trượt phụ, vách đá nứt có nguy cơ lăn sập.",
        "🚒 Rescue Route: Tuyến đường cứu hộ được AI đề xuất cho xe tiếp cận."
    ], ORANGE_ACCENT, "3D Rescue Scene Visualization")

    add_card(s8, Inches(8.8), Inches(1.8), c_w, c_h, "Thanh Trượt Đối Soát & Thẩm Định", [
        "Tính năng Time-slider swipe: Kéo thanh trượt qua lại giữa ảnh vệ tinh trước và sau thiên tai.",
        "Cán bộ trực ban dễ dàng đối soát sự biến mất của thảm thực vật xanh bằng mắt thường.",
        "Hàng đợi thẩm định sạt lở bán tự động: Xem thông tin diện tích, độ dốc và duyệt 1-click.",
        "Xuất báo cáo thống kê thiên tai chuẩn định dạng phục vụ cơ quan quản lý."
    ], GREEN_ACCENT, "Time-slider Swipe & 1-Click Approval")

    # -------------------------------------------------------------------------
    # SLIDE 9: LAM (MOBILE GEOFENCING)
    # -------------------------------------------------------------------------
    s9 = prs.slides.add_slide(blank_layout)
    add_slide_background(s9)
    add_header(s9, "PHÂN HỆ MOBILE CITIZEN APP & GEOFENCING NGOẠI TUYẾN (LÂM PHỤ TRÁCH)", "THÀNH VIÊN 5 • MOBILE APP ENGINEER")

    add_card(s9, Inches(0.8), Inches(1.8), c_w, c_h, "Geofencing Ngoại Tuyến Đột Phá", [
        "Ứng dụng di động Flutter 3.x đa nền tảng (Android & iOS).",
        "Bộ nhớ đệm SQLite cục bộ lưu sẵn >= 10,000 đa giác vùng nguy cơ sạt lở (< 15MB).",
        "Dịch vụ định vị chạy nền (Background Geolocation) liên tục quét tọa độ GPS mỗi 10 giây.",
        "Thuật toán Haversine và Ray-Casting (Point-in-Polygon) kiểm tra không gian siêu tốc (< 20ms)."
    ], CYAN_ACCENT, "Offline-First SQLite & Ray-Casting")

    add_card(s9, Inches(4.8), Inches(1.8), c_w, c_h, "Còi Hú Báo Động Khẩn Cấp", [
        "Tự động kích hoạt khi người dân di chuyển vào vùng sạt lở nguy hiểm.",
        "HOẠT ĐỘNG 100% NGOẠI TUYẾN ngay cả khi mất sạch sóng 4G/Internet.",
        "Chớp màn hình đỏ cảnh báo, rung máy liên tục và hú còi âm lượng tối đa.",
        "Có cơ chế bypass chế độ im lặng của điện thoại để đánh thức người dân trong đêm."
    ], RED_ACCENT, "Báo động khẩn khi mất mạng")

    add_card(s9, Inches(8.8), Inches(1.8), c_w, c_h, "SOS 1-Chạm & Live Rescue Tracking", [
        "Nút SOS khẩn cấp nổi bật: 1-chạm tự động lấy tọa độ GPS chuẩn xác và chụp ảnh hiện trường.",
        "Tự động lưu vào hàng đợi SQLite gửi đi ngay khi có lại kết nối mạng.",
        "Màn hình Live Rescue Tracking hiển thị tiến trình cứu nạn (Đã nhận -> Đội cứu hộ đang đến).",
        "Hiển thị vị trí xe cứu nạn và thời gian dự kiến tiếp cận (ETA) trên bản đồ."
    ], GREEN_ACCENT, "1-Tap SOS & Live Tracking")

    # -------------------------------------------------------------------------
    # SLIDE 10: ROADMAP & CONCLUSION
    # -------------------------------------------------------------------------
    s10 = prs.slides.add_slide(blank_layout)
    add_slide_background(s10)
    add_header(s10, "LỘ TRÌNH TRIỂN KHAI, ĐỊNH HƯỚNG NÂNG CAO & KẾT LUẬN")

    card_w3 = Inches(5.6)
    card_h3 = Inches(2.3)

    add_card(s10, Inches(0.8), Inches(1.8), card_w3, card_h3, "🚀 Kế Hoạch 5 Tuần Tốc Lực (MVP)", [
        "Tuần 1: Dựng nền tảng, PostGIS & Auth JWT 4 roles.",
        "Tuần 2: Ingestion Sentinel-2, DEM Slope và API nhận SOS.",
        "Tuần 3: Tích hợp mô hình ONNX thật, cắt ảnh Tiling và AI Rescue Route.",
        "Tuần 4: Dashboard WebGIS 3D Command Center và Mobile SOS.",
        "Tuần 5: Thông luồng 100%, kiểm thử tải và demo kịch bản thực tế Làng Nủ."
    ], CYAN_ACCENT)

    add_card(s10, Inches(6.9), Inches(1.8), card_w3, card_h3, "📦 Nâng Cấp Capstone (Tháng 3 - Tháng 6)", [
        "Trạm IoT ESP32 quan trắc rung chấn sườn dốc (cảm biến rung & độ ẩm đất đẩy MQTT).",
        "Tích hợp ảnh Radar SAR Sentinel-1 quan sát xuyên mây trong mùa mưa bão.",
        "Tích hợp chỉ số mưa tích lũy Antecedent Rainfall Index (ARI) từ vệ tinh GPM NASA.",
        "Chạy thử nghiệm trên tập dữ liệu thực tế Lào Cai / Yên Bái sau bão Yagi."
    ], ORANGE_ACCENT)

    # Conclusion Banner
    concl = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.5), Inches(11.7), Inches(2.2))
    concl.fill.solid()
    concl.fill.fore_color.rgb = RGBColor(16, 40, 30)
    concl.line.color.rgb = GREEN_ACCENT
    concl.line.width = Pt(1.5)

    tf_c = concl.text_frame
    tf_c.margin_left = Inches(0.4)
    tf_c.margin_top = Inches(0.25)
    p_c1 = tf_c.paragraphs[0]
    p_c1.text = "🎯 KẾT LUẬN & GIÁ TRỊ THỰC TIỄN CỦA ĐỒ ÁN GEOSENTRY:"
    p_c1.font.size = Pt(14)
    p_c1.font.bold = True
    p_c1.font.color.rgb = GREEN_ACCENT

    points = [
        "1. Giải quyết bài toán cấp bách mang tính nhân văn sâu sắc: Bảo vệ tính mạng đồng bào miền núi trước thiên tai sạt lở đất.",
        "2. Hiện thực hóa kiến trúc Microservices 8 thành phần công nghiệp, kết hợp Viễn thám Sentinel-2, AI ONNX Runtime và WebGL 3D.",
        "3. Đột phá với cơ chế Geofencing Ngoại tuyến: Đảm bảo người dân vẫn được còi hú cứu mạng ngay cả khi mất sạch 100% sóng 4G/Internet.",
        "4. Đầy đủ điều kiện kỹ thuật, tính khoa học và tính thực tiễn để bảo vệ đạt điểm Xuất sắc (A+) trước Hội đồng Kỹ sư Phần mềm."
    ]
    for pt in points:
        p_pt = tf_c.add_paragraph()
        p_pt.text = pt
        p_pt.font.size = Pt(11)
        p_pt.font.color.rgb = TEXT_WHITE
        p_pt.space_before = Pt(3)

    # Save
    prs.save(output_path)
    print(f"Successfully generated custom presentation: {output_path}")

if __name__ == "__main__":
    out = "d:/SECapstone/docs/GeoSentry_Capstone_Presentation.pptx"
    if len(sys.argv) > 1:
        out = sys.argv[1]
    create_geosentry_deck(out)
