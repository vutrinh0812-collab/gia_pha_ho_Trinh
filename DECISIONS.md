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

---

## Giai đoạn 2 — Dữ liệu & bảo mật

### D9. Xác định admin: danh sách UID trong `clans/{clanId}/config/admins`
SPEC cho chọn giữa (a) so khớp email + `email_verified` trong rules và (b) danh sách UID. Chọn **(b)** vì:
- Rules không đọc được biến môi trường, nên cách (a) buộc phải ghi cứng email admin vào `firestore.rules` và `storage.rules`. Đổi email sẽ phải sửa rules rồi deploy lại.
- Tài khoản tạo trong Firebase Console có `email_verified = false`. Muốn dùng cách (a) phải thêm bước xác minh email.
- UID không giả mạo được. Rules test chứng minh: người tự đăng ký **trùng email admin** nhưng khác UID vẫn bị chặn.
- Cách (b) theo từng dòng họ, nên sẵn đường mở rộng sang admin theo chi: hàm `isAdmin()` trong rules là điểm mở rộng duy nhất.

Script `npm run admin:setup` dùng Admin SDK để tạo/cập nhật tài khoản, đặt `emailVerified = true`, ghi UID vào `config/admins` và thu hồi các phiên cũ. Tài liệu `config/admins` không ghi được từ client (kể cả admin). Người dùng đã đăng nhập chỉ đọc được tài liệu này nếu chính họ có trong danh sách; giao diện dùng điều đó để biết "mình có phải admin không".
Chi phí: mỗi lần ghi tốn thêm 1 lần đọc `config/admins` trong rules. Không đáng kể.

### D10. Trường meta trên mọi tài liệu ghi được
`persons`, `unions` và `settings/main` đều có `createdAt`, `updatedAt`, `updatedBy`. SPEC chỉ ghi các trường này cho `persons`; bổ sung cho hai collection còn lại để thống nhất. Rules bắt buộc:
- `updatedAt == request.time`: client phải dùng `serverTimestamp()`.
- `updatedBy == uid` của người ghi.
- `createdAt` không đổi khi cập nhật. Khi tạo mới thì cho phép mọi timestamp, để hoàn tác thao tác xóa có thể khôi phục `createdAt` cũ.

Tài liệu **không lưu `id`**. Id lấy từ id của document (`WithId<T>`).

### D11. `isBloodline` và con cháu bên ngoại
- `isBloodline = true`: người sinh ra trong dòng họ, gồm cả con gái. Nếu có nhập, con của con gái cũng là `true`, vì họ có `parentUnionId` và có thể có hôn nhân riêng.
- `isBloodline = false`: dâu/rể.
- "Bên ngoại" **không lưu** mà được tính trong `computeGenerations()`. Nhánh nào đi qua một người con gái (trừ thủy tổ) thì mọi hậu duệ phía dưới, kèm vợ/chồng của họ, được đánh dấu `maternal`. Giao diện dùng cờ này cùng `showMaternalDescendants` để ẩn/hiện.

### D12. Những quy tắc kiểm tra ở client, không đặt trong rules
Firestore rules không truy vấn được collection, nên các quy tắc sau được kiểm tra ở client (giai đoạn 4):
- **"Không xóa người còn con cháu"**, dùng `hasChildren()`.
- **"Mỗi lần ghi phải kèm auditLog"**: client luôn dùng batched write. Rules chỉ đảm bảo mỗi entry audit hợp lệ, đúng người ghi, đúng thời điểm và không sửa/xóa được. Ép buộc 1–1 bằng `getAfter()` sẽ làm rules phức tạp và tốn lượt đọc, nên chưa cần với một admin duy nhất.

Admin là người được tin cậy, nên rủi ro chỉ là lỗi phần mềm, không phải tấn công.

### D13. Storage chỉ nhận ảnh raster
Rules chỉ nhận `image/jpeg|png|webp|gif|avif`, nhỏ hơn 2MB. Không nhận `image/svg+xml` dù SPEC ghi `image/*`, vì SVG có thể chứa script. Ảnh lưu tại `clans/{clanId}/photos/{personId}/…`.

### D14. Âm lịch
- Thuật toán Hồ Ngọc Đức, múi giờ UTC+7. Test round-trip toàn bộ ngày từ 1900 đến 2100, kèm các mốc đã biết: Tết 1985 ở Việt Nam là 21/1 (khác Trung Quốc), các năm có tháng nhuận 2020, 2023, 2025, 2033.
- Sửa một lỗi biên của bản gốc: ngày 7/5/2054 bị tính ra "mùng 0". Nguyên nhân là ước lượng số kỳ trăng lệch 1; nay tìm kỳ trăng mới bằng vòng lặp thay vì tin vào ước lượng.
- **Ngày giỗ:** theo tháng thường, không theo tháng nhuận. Người mất ngày 30 mà năm đó tháng chỉ có 29 ngày thì giỗ vào ngày 29.

### D15. Dữ liệu mẫu
- `src/lib/sampleData.ts` là hàm thuần, có seed cố định: cùng seed cho ra cùng dữ liệu. Script seed dùng hàm này, giai đoạn 5 sẽ dùng cho trang `/themes`.
- Họ mặc định là "Trịnh", theo tên repo. Toàn bộ tên riêng, địa danh và ngày tháng đều hư cấu.
- Có vài người trùng tên, cố ý, để kiểm thử tìm kiếm có hiển thị đời và tên cha.
- Mã admin của emulator là `ma-admin-demo`, chỉ dùng trên máy.

### D16. Chạy test rules sau proxy HTTP
Storage Emulator đọc Firestore Emulator qua HTTP và dùng biến `HTTP(S)_PROXY` nhưng bỏ qua `NO_PROXY`. Trong môi trường có proxy, phải chạy test bằng `env -u HTTPS_PROXY -u HTTP_PROXY npm run test:rules`. Máy cá nhân thông thường không gặp vấn đề này. `firebase.json` cũng ghim các emulator vào `127.0.0.1` để tránh lỗi IPv6.
