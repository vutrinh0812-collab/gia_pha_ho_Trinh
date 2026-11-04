# DECISIONS — Nhật ký quyết định kỹ thuật

Ghi lại các điểm đặc tả (SPEC.md) chưa rõ và phương án đã chọn. Mới nhất ở dưới.

---

## Giai đoạn 1 — Khởi tạo

### D1. Phiên bản thư viện
- React **18.3** (theo SPEC), React Router **6.30**, Firebase JS SDK **10.14** (modular, theo SPEC "v10"), Zustand 5.
- Vite 8 + `@vitejs/plugin-react` 6, Vitest 5.
- **TypeScript 5.9**, không dùng TypeScript 7 (bản viết lại bằng Go) vì một số công cụ trong hệ sinh thái chưa hỗ trợ ổn định.

### D2. TypeScript strict
Bật `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`. Alias `@/` → `src/`.

### D3. Khởi tạo Firebase lười (lazy)
- `src/lib/firebase.ts` chỉ khởi tạo app/Firestore khi được gọi lần đầu.
- **Auth** và **Storage** được `import()` động: người xem không bao giờ tải chúng (chỉ admin cần). Đây là cách giữ bundle lần tải đầu ≤ 250KB gzip.
- Firestore dùng `persistentLocalCache` + `persistentMultipleTabManager` (offline persistence, SPEC §6). Nếu trình duyệt không có IndexedDB (một số trình duyệt nhúng ở chế độ riêng tư) thì lùi về `memoryLocalCache`.

### D4. Emulator
- Dự án emulator dùng id `demo-gia-pha`. Tiền tố `demo-` khiến Firebase CLI **không bao giờ** gọi tới project thật, nên chạy được mà không cần đăng nhập.
- `npm run dev:emu` nạp `.env.emulator` (đã commit, không chứa bí mật).
- Dữ liệu emulator được lưu vào `.emulator-data/` (đã gitignore) khi tắt.

### D5. Rules tạm ở giai đoạn 1
`firestore.rules` và `storage.rules` hiện **chỉ cho đọc, cấm mọi thao tác ghi**. Đây là trạng thái an toàn trước khi có rules admin đầy đủ + test ở giai đoạn 2.

### D6. Font
Be Vietnam Pro được nạp từ Google Fonts (có subset `vietnamese`, giấy phép OFL). Việc tự host font (để chạy offline/PWA và nhúng TTF vào PDF) sẽ xử lý ở giai đoạn 3d/6.

### D7. Cỡ chữ
`body` = 15px (0.9375rem) theo SPEC 5A.2, dùng đơn vị `rem` để tôn trọng cỡ chữ hệ thống. Thuộc tính `html[data-large-text="true"]` dành sẵn cho nút "Chữ lớn" (giai đoạn 3a).

### D8. Cloud Storage và gói Spark (cần lưu ý)
SPEC yêu cầu chạy được trên gói **Spark miễn phí**. Tuy nhiên, Google đã thay đổi chính sách: các project mới phải nâng lên gói **Blaze** (trả theo dùng, vẫn có hạn mức miễn phí) mới tạo được bucket Cloud Storage mặc định. Firestore, Auth và Hosting vẫn chạy trên Spark.
- Giai đoạn 1–3 không cần Storage.
- Ảnh đại diện (giai đoạn 4) sẽ được viết sao cho **Storage là tùy chọn**: nếu không bật Storage, app vẫn chạy đầy đủ, chỉ ẩn chức năng tải ảnh lên. Phương án dự phòng sẽ được chốt ở giai đoạn 4.
