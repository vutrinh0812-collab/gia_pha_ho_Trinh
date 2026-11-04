# PROMPT TỔNG — Web App Gia Phả Dòng Họ (React + Firebase)

> Lưu thành `SPEC.md` ở thư mục gốc dự án. Yêu cầu Claude Code: "Đọc SPEC.md và triển khai theo từng giai đoạn."

---

## 0. Vai trò & cách làm việc

Bạn là kỹ sư full-stack. Hãy xây dựng web app gia phả theo đặc tả dưới đây.

**Quy tắc làm việc:**
- Triển khai **theo từng giai đoạn** (mục 12).
- Sau mỗi giai đoạn: dừng lại, tóm tắt những gì đã làm, hướng dẫn tôi chạy thử, rồi chờ tôi xác nhận trước khi sang giai đoạn tiếp theo.
- Toàn bộ **giao diện người dùng bằng tiếng Việt**. Code và comment bằng tiếng Anh.
- TypeScript strict. Không dùng `any` nếu tránh được.
- Nếu gặp điểm chưa rõ trong đặc tả: chọn phương án hợp lý nhất, ghi lại trong `DECISIONS.md`, rồi tiếp tục làm.

---

## 1. Mục tiêu sản phẩm

Web app dùng để lưu giữ và cập nhật gia phả của **một dòng họ**. Dữ liệu được hiển thị dưới dạng **cây sơ đồ** theo đời.

**Đối tượng sử dụng:**
- **Người xem (công khai):** ai có link đều xem được toàn bộ cây và chi tiết từng người. Không cần đăng nhập.
- **Admin:** nhập **mã admin** để bật chế độ chỉnh sửa. Mọi thao tác thêm, sửa, xóa đều yêu cầu quyền admin, và quyền này được kiểm tra ở **Firebase Security Rules**, không chỉ ở giao diện.

**Quy mô:**
- Tối thiểu khoảng 7 đời, 300–500 người.
- Phải mở rộng mượt lên khoảng **3.000 người**, không giới hạn số đời.

**MOBILE-FIRST:**
- Đa số người dùng xem bằng **điện thoại**, phần lớn mở qua link chia sẻ trên Zalo/Facebook.
- Thiết kế và kiểm thử cho điện thoại trước (màn hình 360–430px), sau đó mới mở rộng cho tablet và desktop.
- Xem chi tiết ở **mục 5A**. Khi có xung đột giữa trải nghiệm điện thoại và desktop, **ưu tiên điện thoại**.

**Ba chức năng cốt lõi:**
1. **Sơ đồ cây trên màn hình** có **semantic zoom**: phóng to đến đâu, thông tin hiện ra đến đó.
2. **Chỉnh sửa dữ liệu** có bảo vệ bằng mã admin và có lịch sử thay đổi.
3. **Hệ thống theme** để **in khổ A1**. Mỗi theme là một bộ design system riêng: màu sắc, kiểu chữ, khung, họa tiết.

---

## 2. Tech stack

| Hạng mục | Lựa chọn |
|---|---|
| Framework | React 18 + Vite + TypeScript |
| State | Zustand |
| Styling | CSS variables (design tokens) + CSS Modules hoặc Tailwind chỉ cho phần UI shell |
| Backend | Firebase v10 modular: Firestore, Auth (email/password), Storage (ảnh), Hosting |
| Layout cây | `d3-flextree` (Reingold–Tilford cho node có kích thước khác nhau) + `d3-zoom` |
| Render cây | SVG, có virtualization (chỉ render node nằm trong viewport + một khoảng đệm) |
| Xuất PDF vector | `jsPDF` + `svg2pdf.js`, **nhúng font TTF có dấu tiếng Việt** |
| Xuất ảnh | PNG qua canvas (150 hoặc 300 dpi) |
| Import/Export | SheetJS (`xlsx`) cho Excel, JSON cho backup |
| Lịch âm | Thuật toán âm lịch Việt Nam (Hồ Ngọc Đức), viết thành module riêng `lunar.ts` có unit test |
| Test | Vitest + React Testing Library |
| Router | React Router: `/` (cây), `/person/:id`, `/print`, `/admin`, `/anniversaries` |

---

## 3. Mô hình dữ liệu (Firestore)

Cấu trúc thư mục dữ liệu là `clans/{clanId}/...`. Hiện tại chỉ có một dòng họ, `clanId` lấy từ biến môi trường `VITE_CLAN_ID`. Cấu trúc này giữ sẵn khả năng mở rộng về sau.

```ts
type Gender = 'male' | 'female';

interface DateInfo {
  solar?: string;            // 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY' (cho phép không đầy đủ)
  lunar?: { day?: number; month?: number; year?: number; isLeapMonth?: boolean };
  approximate?: boolean;     // "khoảng năm…"
  place?: string;
}

// clans/{clanId}/persons/{personId}
interface Person {
  id: string;
  fullName: string;               // "Vũ Đăng Tấn"
  otherNames?: { huy?: string; tu?: string; hieu?: string; thuong?: string }; // tên húy, tự, hiệu, tên thường gọi
  gender: Gender;
  isBloodline: boolean;           // true = huyết thống họ Vũ Đăng; false = dâu/rể
  parentUnionId?: string | null;  // sinh ra từ cặp vợ chồng nào (null = thủy tổ hoặc dâu/rể)
  birthOrder?: number;            // thứ tự con trong union (1, 2, 3…)
  birth?: DateInfo;
  death?: DateInfo & { isDeceased: boolean };
  deathAnniversaryLunar?: { day: number; month: number }; // ngày giỗ (âm lịch)
  burialPlace?: string;
  photoUrl?: string;
  occupation?: string;
  notes?: string;
  branchLabel?: string;           // tên chi/nhánh, ví dụ "Chi Giáp"
  createdAt: Timestamp; updatedAt: Timestamp; updatedBy: string;
}

// clans/{clanId}/unions/{unionId}  — quan hệ hôn nhân
interface Union {
  id: string;
  bloodlinePersonId: string;      // người thuộc huyết thống
  spousePersonId?: string;        // dâu hoặc rể (có thể chưa rõ)
  order: number;                  // vợ cả = 1, vợ hai = 2… (hỗ trợ nhiều vợ/chồng)
  status?: 'married' | 'divorced' | 'widowed';
  notes?: string;
}

// clans/{clanId}/settings/main
interface ClanSettings {
  clanName: string;               // "Vũ Đăng"
  title: string;                  // "Hệ Phả Họ Vũ Đăng"
  subtitle?: string;              // "Từ đời 1 đến đời 7 – Thôn…, Xã…"
  rootPersonId: string;           // thủy tổ
  coupletLeft: string;            // câu đối trái
  coupletRight: string;           // câu đối phải
  colophon: string;               // lạc khoản góc dưới
  defaultThemeId: string;
  showMaternalDescendants: boolean; // hiển thị con của con gái (mặc định false)
}

// clans/{clanId}/auditLog/{logId}
interface AuditEntry {
  at: Timestamp; by: string;
  action: 'create' | 'update' | 'delete';
  collection: 'persons' | 'unions' | 'settings';
  docId: string;
  before?: object; after?: object; // để hoàn tác
}
```

**Quy tắc nghiệp vụ:**
- **Đời** (`generation`) **không lưu trong database** mà được tính từ thủy tổ. Thủy tổ là đời 1; đời của con = đời của cha/mẹ huyết thống + 1. Dâu/rể mang cùng đời với người phối ngẫu của mình.
- **Dâu và rể đều được ghi tên.** Chúng hiển thị trong cùng "ô gia đình" với người huyết thống, giống bố cục 2 mẫu tham khảo: tên chính ở trên, tên phối ngẫu ở dưới với màu khác.
- **Con của con gái** (bên ngoại): dữ liệu được phép nhập. Việc có hiển thị trên cây hay không do `showMaternalDescendants` quyết định.
- **Một người nhiều vợ/chồng:** các con được nhóm theo từng union, và nhánh con ghi chú "con bà cả", "con bà hai".
- **Xóa an toàn:** không cho xóa người còn có con cháu. Phải xóa hoặc chuyển con cháu trước. Mọi thao tác xóa đều có hộp thoại xác nhận.
- **Ghi đồng thời:** dùng **batched write** để ghi dữ liệu và `auditLog` cùng lúc.

---

## 4. Phân quyền & mã admin

**Phương án: Firebase Auth email/password với một tài khoản admin duy nhất.**
- Phương án này chạy được trên gói **Spark miễn phí**.
- Email admin cố định trong `VITE_ADMIN_EMAIL`.
- Ở giao diện, người dùng chỉ thấy một ô **"Nhập mã admin"**. "Mã admin" chính là mật khẩu của tài khoản này.
- Đổi mã admin = đổi mật khẩu trong Firebase Console. Hãy viết hướng dẫn trong README.

**Hành vi phiên đăng nhập:**
- Khi đăng nhập thành công, hiện huy hiệu "Đang ở chế độ Admin" và nút Thoát.
- Tự đăng xuất sau 30 phút không thao tác.

**Firestore rules (bắt buộc):**
- `persons`, `unions`, `settings`: ai cũng **đọc** được; chỉ admin **ghi** được.
- `auditLog`: chỉ admin đọc và ghi; không ai sửa hoặc xóa được entry đã ghi.
- Validate kiểu dữ liệu và trường bắt buộc ngay trong rules: `fullName` là string, độ dài 1–100; `gender` thuộc enum; …
- Admin được xác định bằng `request.auth.token.email == '<ADMIN_EMAIL>'` **và** `email_verified`. Hoặc dùng danh sách UID trong `config/admins`, chọn cách nào gọn hơn và ghi vào `DECISIONS.md`.

**Storage rules:**
- Ảnh: ai cũng đọc được; chỉ admin upload được.
- Chỉ nhận file `image/*`, tối đa 2MB.
- Resize ảnh ở client trước khi upload, cạnh dài tối đa 800px.

**Bảo vệ cấu hình:**
- Bật **Firebase App Check** (reCAPTCHA v3) nếu khả thi.
- Viết test cho rules bằng `@firebase/rules-unit-testing` với emulator.

**Chuẩn bị mở rộng:** cấu trúc code để sau này có thể chuyển sang nhiều mã admin theo chi (Cloud Functions + custom claims) mà không phải viết lại. Chưa cần làm phần này.

---

## 5. Màn hình chính — Sơ đồ cây (dashboard mặc định)

**Ưu tiên:** hiển thị **đầy đủ, rõ ràng, dễ đọc**. Không cần mô phỏng khung tranh trên màn hình.

### 5.1 Bố cục
- Canvas sơ đồ chiếm toàn màn hình, nền tối giản (theme `minimal`).
- Thanh công cụ nổi gồm: Tìm kiếm · Phóng/thu · Vừa màn hình · Về thủy tổ · Thu gọn/mở rộng tất cả · Chọn theme · In · Mã admin.
- **Cột đánh dấu đời** ("Đời 1", "Đời 2"…) dính bên trái, cuộn theo trục dọc của sơ đồ. Có thể thêm dải nền nhạt xen kẽ theo từng đời.
- Mini-map ở góc dưới để định vị trong cây lớn.
- Responsive cho điện thoại:
  - Pan và zoom bằng cử chỉ chụm.
  - Panel chi tiết hiện dạng bottom sheet.

### 5.2 Ô gia đình (node)
- Một node = người huyết thống + các phối ngẫu xếp bên dưới (theo `order`).
- Đường nối kiểu vuông góc (orthogonal): từ node cha mẹ xuống thanh ngang, rồi xuống từng con. Thứ tự con từ trái sang phải theo `birthOrder`.
- Mã màu phân biệt (theo theme):
  - nam / nữ huyết thống;
  - dâu/rể;
  - đã mất (có thể kèm ký hiệu nhỏ).
- Mỗi node có nút thu gọn/mở rộng nhánh con, kèm badge số con cháu bị ẩn.

### 5.3 Semantic zoom — phóng đến đâu, thông tin mở ra đến đó

| Mức | Zoom | Nội dung hiển thị trong node |
|---|---|---|
| L0 – Toàn cảnh | < 0.35 | Khối màu theo giới tính/nhánh; chỉ hiện tên các đời đầu và tên chi |
| L1 – Tổng quan | 0.35–0.7 | Họ tên đầy đủ |
| L2 – Tiêu chuẩn | 0.7–1.3 | + năm sinh–mất, tên dâu/rể, thứ tự con |
| L3 – Chi tiết | 1.3–2.2 | + tên húy/tự, ảnh đại diện nhỏ, ngày giỗ âm lịch |
| L4 – Đầy đủ | > 2.2 | + nơi sinh, nơi an táng, nghề nghiệp, ghi chú ngắn |

**Yêu cầu kỹ thuật cho semantic zoom:**
- **Layout tính một lần** với kích thước node ở mức L2. Ở mức thấp, chỉ thay nội dung bên trong node để vị trí các node không nhảy.
- Khi ở mức L3–L4 mà nội dung tràn khỏi node, dùng card mở rộng đè lên (overlay), không reflow toàn cây.
- Chuyển mức có hiệu ứng mờ dần ngắn (≤150ms).
- Mức zoom và LOD tính theo `transform.k` của d3-zoom.
- Chỉ render các node nằm trong viewport (virtualization).
- Mục tiêu hiệu năng: 60fps với 3.000 người trên laptop tầm trung.

### 5.4 Tương tác
- **Click vào node:** mở panel chi tiết bên phải gồm toàn bộ thông tin, danh sách cha mẹ / vợ chồng / con, các link nhảy nhanh, và đường dẫn chia sẻ `/person/:id`.
- **Tìm kiếm:** tìm theo tên, không phân biệt dấu (vd. "vu dang tan" khớp "Vũ Đăng Tấn"). Khi chọn kết quả, sơ đồ bay tới node đó và highlight.
- **"Xem dòng dõi":** highlight đường từ người được chọn ngược về thủy tổ; các nhánh khác làm mờ.
- **Lọc:** theo chi, theo khoảng đời, ẩn/hiện dâu-rể, ẩn/hiện bên ngoại.
- Trạng thái zoom và vị trí được lưu vào URL query để chia sẻ đúng góc nhìn.

---

## 5A. Tối ưu riêng cho điện thoại (ưu tiên cao nhất)

### 5A.1 Ba chế độ xem trên điện thoại
Cây gia phả lớn rất khó đọc trên màn hình nhỏ, nên điện thoại có 3 chế độ xem. Người dùng chuyển giữa chúng bằng thanh điều hướng dưới cùng.

1. **"Gia đình"** — chế độ mặc định trên điện thoại.
   - Một người nằm ở giữa màn hình. Phía trên là cha mẹ. Bên cạnh là vợ/chồng. Phía dưới là các con, xếp thành hàng có thể cuộn ngang.
   - Chạm vào ai thì người đó trở thành trung tâm, có animation chuyển cảnh mượt.
   - Vuốt lên để đi về đời trước.
   - Thanh breadcrumb dòng dõi ở trên cùng, ví dụ "Đời 1 › Đời 2 › … › Đời 6". Chạm vào một mục để nhảy về đời đó.
   - Đây là cách xem chính. Phải đọc được mà không cần zoom.
2. **"Sơ đồ"** — cây đầy đủ như mục 5.
   - Dùng cử chỉ chụm để zoom, kèm semantic zoom.
   - Gợi ý xoay ngang màn hình để xem rộng hơn. Hỗ trợ đầy đủ khi xoay ngang.
   - Ngưỡng các mức LOD được tính theo kích thước chữ thực tế hiển thị trên màn hình (px), không theo `transform.k` thuần, để đọc được trên màn hình nhỏ.
3. **"Danh sách"** — xem theo đời.
   - Accordion "Đời 1 … Đời N", mở ra thấy danh sách người của đời đó, nhóm theo chi.
   - Hợp với người lớn tuổi và màn hình rất nhỏ.

Từ bất kỳ chế độ nào, chạm vào một người sẽ mở **bottom sheet chi tiết**: kéo lên nửa màn hình hoặc toàn màn hình, vuốt xuống để đóng.

### 5A.2 Giao diện & thao tác
- **Bottom navigation** gồm: Gia đình · Sơ đồ · Danh sách · Tìm kiếm · Thêm (ngày giỗ, theme, in, admin).
- **Tìm kiếm:** mở overlay toàn màn hình, gõ không dấu. Kết quả hiển thị kèm đời và tên cha để phân biệt người trùng tên.
- **Kích thước chạm và chữ:**
  - Vùng chạm tối thiểu **44×44px**.
  - Chữ thân tối thiểu **15px**, tên trong chế độ Gia đình ≥ 17px.
  - Tôn trọng cài đặt cỡ chữ của hệ thống.
  - Có nút "Chữ lớn" trong cài đặt cho người lớn tuổi.
- **Thao tác một tay:** các nút chính nằm trong vùng ngón cái chạm tới (nửa dưới màn hình).
- **Màn hình tai thỏ:** dùng `env(safe-area-inset-*)` cho iPhone có notch/Dynamic Island.
- Mặc định theme `minimal` theo chế độ sáng/tối của hệ thống.
- **Admin trên điện thoại:**
  - Nhấn giữ vào một người để mở menu thao tác.
  - Form sửa mở toàn màn hình, chia nhóm trường.
  - Bộ chọn ngày hỗ trợ chọn chỉ năm.
  - Upload ảnh trực tiếp từ camera hoặc thư viện ảnh.

### 5A.3 Hiệu năng trên máy yếu
- Mục tiêu thiết bị: Android tầm trung/thấp (khoảng 3GB RAM) và mạng 4G yếu.
- **Ngân sách bundle:**
  - Lần tải đầu ≤ **250KB gzip**.
  - Lazy-load các module `print`, `admin`, `xlsx`, `jsPDF` và các theme in. Không tải chúng khi chỉ xem.
- Chế độ Gia đình và Danh sách chỉ đọc dữ liệu cần thiết. Tải toàn bộ cây chỉ khi mở chế độ Sơ đồ, có cache.
- **Sơ đồ trên điện thoại:**
  - Virtualization chặt hơn.
  - Tắt hiệu ứng bóng đổ và gradient khi đang pan/zoom.
  - Nếu SVG giật với cây lớn, chuyển sang render bằng Canvas. Ghi lại quyết định vào `DECISIONS.md`.
- Ảnh đại diện có thumbnail riêng (khoảng 120px), lazy-load.

### 5A.4 PWA & chia sẻ
- **PWA:**
  - Có manifest và icon để "Thêm vào màn hình chính".
  - Service worker cache app shell và dữ liệu đã xem, để xem được khi mất mạng.
- **Chia sẻ:**
  - Nút "Chia sẻ" dùng Web Share API, ví dụ chia sẻ link một người `/person/:id`.
  - Có thẻ **Open Graph** (tiêu đề dòng họ, ảnh xem trước) để link hiển thị đẹp khi gửi qua **Zalo, Messenger, Facebook**.
- **Trình duyệt nhúng:** kiểm tra hoạt động đúng trong **trình duyệt nhúng của Zalo và Facebook**, cùng Safari iOS và Chrome Android.

### 5A.5 In từ điện thoại
- Trên điện thoại vẫn cho xem trước bản in A1 và xuất PDF.
- Hiển thị gợi ý "Nên dùng máy tính để chỉnh bố cục in".
- Việc xuất PDF chạy trong Web Worker để không treo giao diện.

### 5A.6 Kiểm thử mobile
- Playwright với các thiết bị giả lập: **iPhone SE, iPhone 14, Pixel 5, Galaxy A** (360px).
- Kịch bản test:
  - mở link → xem Gia đình → tìm một người → mở chi tiết → chia sẻ;
  - xoay ngang khi xem Sơ đồ.
- Mục tiêu Lighthouse **Mobile**: Performance ≥ 85, Accessibility ≥ 95.

---

## 6. Chế độ Admin (chỉnh sửa)

Khi đã nhập mã admin, mỗi node có thêm menu:
- Sửa thông tin
- Thêm con
- Thêm vợ/chồng
- Thêm cha (chỉ khi node là gốc, dùng để nối thêm đời trên)
- Đổi thứ tự anh em
- Xóa

**Form người:**
- Có sẵn các trường ở mục 3.
- Nhập ngày dương thì tự gợi ý ngày âm, và ngược lại.
- Cho phép nhập ngày không đầy đủ (chỉ năm).
- Upload ảnh.

**Các trang admin:**
- **Cài đặt dòng họ:** sửa tên, tiêu đề, câu đối, lạc khoản, theme mặc định, `showMaternalDescendants`.
- **Lịch sử thay đổi:** xem danh sách `auditLog`, lọc theo người/ngày, và **hoàn tác** từng thay đổi (khôi phục `before`).
- **Nhập/xuất dữ liệu:**
  - Tải file Excel mẫu, nhập hàng loạt từ Excel.
  - Có bước **xem trước và báo lỗi** trước khi ghi: thiếu cha mẹ, trùng tên trong cùng nhánh, vòng lặp quan hệ…
  - Xuất JSON để backup toàn bộ dữ liệu.
  - Khôi phục từ JSON.

**Hành vi dữ liệu:**
- Realtime: dùng `onSnapshot` nên mọi người xem thấy thay đổi ngay.
- Bật offline persistence.

---

## 7. Hệ thống Theme (design system)

Mỗi theme là một module `src/themes/<id>/` gồm:
- `theme.ts`: design tokens;
- `ornaments/*.svg`: họa tiết;
- font khai báo trong `theme.ts`.

Thêm theme mới = thêm thư mục mới, **không sửa code lõi**.

```ts
interface Theme {
  id: string; name: string; description: string;
  usage: ('screen' | 'print')[];
  colors: {
    background: string; surface: string; frame: string; frameInner?: string;
    line: string; textPrimary: string; textSecondary: string;
    male: string; female: string; spouse: string; deceased: string;
    accent: string; generationBand: string;
  };
  typography: {
    title: FontSpec; heading: FontSpec; name: FontSpec; body: FontSpec; couplet: FontSpec;
  }; // FontSpec = { family, weight, sizePt, letterSpacing?, ttfUrl (để nhúng vào PDF) }
  node: {
    radius: number; borderWidth: number; borderStyle: 'single' | 'double';
    fill: string; shadow?: string;
    orientation: 'horizontal' | 'vertical' | 'auto'; // auto = đời sau chuyển sang ô dọc khi thiếu chỗ
    paddingMm: number;
  };
  connector: { style: 'orthogonal' | 'curved'; width: number; color: string };
  frame: { enabled: boolean; borderSvg?: string; cornerSvg?: string; thicknessMm: number };
  ornaments: {
    titleBanner?: string;           // SVG băng rôn tiêu đề
    showCouplets: boolean;          // câu đối hai bên
    decorations?: { svg: string; position: 'top-left' | 'top-right' | 'bottom' | 'background' }[];
  };
  backgroundTexture?: string;
}
```

**Theme cần làm ở bản đầu:**

1. **`minimal`** — mặc định cho màn hình.
   - Nền trơn, có **chế độ sáng và tối**.
   - Font không chân **Be Vietnam Pro**.
   - Khung node mảnh, tương phản cao.
   - Màu nam/nữ/dâu-rể phân biệt rõ và đạt chuẩn tương phản WCAG AA.
   - Không họa tiết. Ưu tiên đọc được ở mọi mức zoom.
2. **`truyen-thong-do`** — lấy cảm hứng từ gia phả truyền thống.
   - Nền giấy kem, khung đỏ son viền hoa văn chữ Vạn/hồi văn.
   - Băng rôn tiêu đề dạng cuộn thư.
   - Câu đối đỏ hai bên, cành mai vàng.
   - Chữ tên màu xanh dương/đỏ; dâu/rể màu xanh lá.
   - Font có chân (Noto Serif / Lora), tiêu đề đậm.
3. **`son-mai-vang`** — phong cách sơn mài.
   - Nền đen nâu, chữ và khung vàng kim (dùng gradient cho cảm giác ánh kim).
   - Họa tiết rồng, mây, hạc, sen, sơn thủy mờ ở nền.
   - Câu đối chữ thư pháp.
   - Lạc khoản có khung hoa văn.

**Lưu ý về theme:**
- Toàn bộ họa tiết SVG phải **tự vẽ, nguyên bản**, chỉ lấy cảm hứng phong cách, không sao chép hình có sẵn. Bắt đầu với họa tiết đơn giản, sạch, để tôi có thể thay SVG sau.
- Chỉ dùng font có **subset tiếng Việt** trên Google Fonts và giấy phép OFL. Kiểm tra tên có dấu như "Vũ Đăng Tuyển", "Nguyễn Thị Ngọc" hiển thị đúng.
- Có trang `/themes` xem trước tất cả theme trên cùng một dữ liệu mẫu.

---

## 8. In ấn khổ A1

Trang `/print` là **trình dàn trang in**, xem trước đúng tỉ lệ A1.

**Khổ giấy:**
- A1 = **841 × 594 mm** (ngang, mặc định) hoặc 594 × 841 mm (dọc).
- Lề an toàn 15mm.

**Tùy chọn in:**
- Theme in (mặc định `truyen-thong-do`).
- Phạm vi: toàn bộ cây / một chi (chọn người làm gốc) / từ đời X đến đời Y.
- Bật/tắt: năm sinh–mất, dâu-rể, tên húy, ảnh, câu đối, lạc khoản, cột đánh dấu đời.
- Hướng giấy.

**Thành phần dàn trang (giống 2 mẫu tham khảo):**
- Băng rôn tiêu đề + phụ đề ở trên.
- Tên thủy tổ nổi bật dưới tiêu đề.
- Câu đối dọc hai bên.
- Cột "Đời 1…N" dọc mép.
- Lạc khoản ở góc dưới phải.
- Khung viền theo theme.

**Tự động co giãn (auto-fit):**
1. Tính tỉ lệ để cây vừa vùng in.
2. Nếu cỡ chữ tên nhỏ hơn **6pt**: tự chuyển các đời dưới cùng sang **ô dọc** (chữ viết dọc từng chữ, giống mẫu tham khảo), sau đó tính lại.
3. Nếu vẫn dưới 6pt: hiện cảnh báo và gợi ý in theo chi, hoặc chia thành nhiều tờ A1.

**Xuất file:**
- **PDF vector**: nhúng font TTF tiếng Việt; kiểm tra chữ có dấu trong PDF hiển thị đúng.
- **SVG**.
- **PNG** 150 dpi (≈ 4967×3508 px) hoặc 300 dpi. Cảnh báo dung lượng khi chọn 300 dpi.

**Kiểm thử in:** viết test tạo PDF từ dữ liệu mẫu và kiểm tra đúng kích thước 841×594 mm.

---

## 9. Lịch ngày giỗ

- Trang `/anniversaries` liệt kê ngày giỗ sắp tới trong 60 ngày.
- Ngày giỗ âm lịch được quy đổi ra dương lịch của năm hiện tại.
- Mỗi mục hiển thị: tên, đời, chi, số năm đã mất.
- Có nút xuất `.ics` để thêm vào lịch điện thoại.

---

## 10. Dữ liệu mẫu (seed)

Viết script `scripts/seed.ts` tạo dữ liệu **hư cấu** (không dùng tên thật trong ảnh mẫu) có cấu trúc tương tự mẫu tham khảo:
- 1 thủy tổ, 2 nhánh lớn, khoảng 7 đời, khoảng 300 người;
- có dâu, rể, một người có 2 vợ, vài người chưa rõ năm sinh;
- có con gái kèm chồng và con (bên ngoại).

Seed chạy được trên **Firebase Emulator**, và có tùy chọn chạy lên project thật.

---

## 11. Cấu trúc thư mục đề xuất

```
src/
  app/            # router, layout, providers
  features/
    tree/         # layout (flextree), render SVG, zoom/LOD, virtualization, minimap
    person/       # panel chi tiết, form
    admin/        # đăng nhập mã, audit log, import/export, settings
    print/        # dàn trang A1, auto-fit, xuất PDF/SVG/PNG
    anniversaries/
  themes/         # minimal/, truyen-thong-do/, son-mai-vang/, index.ts (registry)
  lib/            # firebase.ts, lunar.ts, generation.ts, search (bỏ dấu), validators
  store/          # zustand
firestore.rules
storage.rules
tests/            # unit + rules tests
scripts/seed.ts
DECISIONS.md
README.md         # hướng dẫn tạo Firebase project, .env, deploy, đổi mã admin
```

---

## 12. Các giai đoạn triển khai

Dừng lại sau mỗi giai đoạn để tôi kiểm tra.

1. **Khởi tạo**
   - Vite + TS + Firebase SDK, cấu hình emulator, `.env.example`.
   - README hướng dẫn tạo Firebase project từng bước cho người không chuyên.
2. **Dữ liệu & bảo mật**
   - Types, Firestore rules + Storage rules, kèm test rules.
   - `generation.ts` (tính đời), `lunar.ts`, kèm unit test.
   - Seed dữ liệu mẫu.
3. **Xem gia phả — mobile-first**
   - **3a.** Shell mobile: bottom navigation, chế độ **Gia đình**, chế độ **Danh sách**, bottom sheet chi tiết, tìm kiếm không dấu, theme `minimal` sáng/tối.
   - **3b.** Chế độ **Sơ đồ**:
     - Layout flextree, semantic zoom 5 mức, virtualization, cột đời, minimap.
     - Hỗ trợ chụm zoom và xoay ngang.
     - Highlight dòng dõi, thu gọn nhánh.
   - **3c.** Bố cục desktop: panel chi tiết bên phải, phím tắt.
   - **3d.** PWA, Open Graph, Web Share, kiểm thử trên Zalo/Facebook in-app browser.
4. **Admin**
   - Đăng nhập bằng mã, tự đăng xuất.
   - Thêm/sửa/xóa người và union qua batched write + auditLog.
   - Hoàn tác thay đổi.
   - Trang cài đặt dòng họ.
5. **Hệ thống theme**
   - Registry theme, 3 theme, họa tiết SVG nguyên bản, trang `/themes`.
   - Chuyển theme trực tiếp trên cây.
6. **In A1**
   - Trình dàn trang, auto-fit, ô dọc cho các đời dưới.
   - Xuất PDF vector có font tiếng Việt, SVG, PNG.
7. **Hoàn thiện**
   - Import/export Excel và JSON.
   - Lịch ngày giỗ + `.ics`.
   - App Check, tối ưu hiệu năng với 3.000 node, deploy lên Firebase Hosting.

**Tiêu chí hoàn thành chung:**
- `npm run build` không lỗi; `npm test` pass.
- Lighthouse **Mobile** Performance ≥ 85 và Accessibility ≥ 95.
- Bundle lần tải đầu ≤ 250KB gzip.
- Test Playwright trên các thiết bị giả lập ở mục 5A.6 đều pass.
- Không có thao tác ghi nào thành công khi chưa nhập mã admin. Phải chứng minh điều này bằng test rules.
