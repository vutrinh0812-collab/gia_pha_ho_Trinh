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

### D17. Chế độ demo và bản xem thử không cần terminal
Người dùng không chạy được lệnh terminal, nên mỗi giai đoạn được giao kèm một **bản xem thử** mở được trên điện thoại.
- `VITE_DATA_SOURCE=demo`: app chạy trên dữ liệu mẫu hư cấu trong trình duyệt, không cần Firebase. Lựa chọn nguồn dữ liệu được quyết định lúc build, nên bản demo không chứa mã Firebase và bản thật không chứa bộ sinh dữ liệu mẫu.
- `VITE_ROUTER=memory`: dùng `MemoryRouter`, vì trang nhúng không định tuyến theo đường dẫn URL được.
- `npm run build:preview` đóng gói thành **một file HTML duy nhất** (CSS + JS nội tuyến, khoảng 190KB). Claude đăng file này thành trang riêng tư trên claude.ai.
- Lớp `src/lib/data/` (`loadClanSnapshot`) là chỗ duy nhất biết dữ liệu đến từ đâu. Giai đoạn 3 sẽ mở rộng lớp này thay vì gọi Firestore trực tiếp từ giao diện.

---

## Giai đoạn 3a — Giao diện điện thoại

### D18. Các lớp phủ nằm trên URL
Bảng chi tiết (`?ct=<id>`), tìm kiếm (`?tk=1`), menu "Thêm" (`?them=1`) và người đang ở giữa chế độ Gia đình (`?p=<id>`) đều lưu trong URL. Nhờ vậy:
- nút **Quay lại** của điện thoại đóng lớp phủ, không thoát khỏi app;
- link chia sẻ mở đúng chỗ.

Link chia sẻ `/person/:id` chuyển thành `/?p=id&ct=id`. Mở từ kết quả tìm kiếm thì thay thế mục lịch sử, để bấm Quay lại không mở lại ô tìm kiếm.

### D19. Cử chỉ "vuốt lên để về đời trước"
SPEC ghi "vuốt lên để đi về đời trước". Cử chỉ này chỉ gắn vào **thẻ người ở giữa**, để không lẫn với thao tác cuộn trang. Có thêm nút "Lên đời trước" và thanh dòng dõi cho người không quen vuốt.

### D20. Tải toàn bộ dòng họ một lần (tạm thời)
SPEC 5A.3 yêu cầu chế độ Gia đình và Danh sách chỉ đọc phần dữ liệu cần thiết. Hiện app vẫn tải toàn bộ `persons` và `unions` một lần, qua `onSnapshot` có cache offline, vì:
- ước tính khoảng 300–500 người ≈ 150–250KB, đọc một lần rồi lấy từ cache;
- tính đời, dòng dõi và tìm kiếm đều cần toàn bộ quan hệ.

Sẽ đo lại với 3.000 người ở giai đoạn 7. Nếu chậm trên 4G yếu thì thêm một tài liệu chỉ mục gọn (tên, quan hệ) do admin ghi kèm.

### D21. Màu theo vai trò
Màu theo vai trò: nam (xanh dương), nữ (hồng đậm), dâu/rể (xanh lá), cả ở chế độ sáng và tối. Người đã mất có chữ "đã mất" màu xám, không dùng biểu tượng tôn giáo.

### D22. Tùy chọn trên từng máy
Theme sáng/tối, "Chữ lớn" và "Hiện con cháu bên ngoại" lưu trong `localStorage` của từng máy. Nếu trình duyệt chặn bộ nhớ thì tùy chọn vẫn chạy nhưng mất khi tải lại trang. "Hiện bên ngoại" mặc định theo `showMaternalDescendants` của dòng họ.

---

## Giai đoạn 3b — Sơ đồ

### D23. Ngưỡng semantic zoom
- **Máy tính (chuột):** theo đúng `transform.k` của SPEC: 0,35 / 0,7 / 1,3 / 2,2.
- **Màn hình cảm ứng:** theo cỡ chữ tên hiển thị thật trên màn hình (SPEC 5A.1): 7,5 / 10,5 / 15 / 22 px. Ngưỡng L4 chọn sao cho một ô người vẫn vừa màn hình điện thoại khoảng 360px.
- Layout luôn tính theo cỡ ô của mức L2. Đổi mức chỉ thay nội dung bên trong ô (mờ dần 140ms), vị trí các ô không đổi.

### D24. Ô mở rộng ở mức L3/L4
Ở L3/L4, ô người **kéo dài xuống khoảng trống giữa hai đời** (cao 76 đơn vị) và được vẽ đè lên các đường nối, kèm bóng đổ. Đây là cách làm "card mở rộng đè lên" mà không phải dàn lại cây. Thông tin quá dài thì cắt bằng "…"; xem đầy đủ trong bảng chi tiết.

### D25. SVG, chưa dùng Canvas
Đã đo: dữ liệu mẫu (219 ô) ở mức L0 và khoảng 3.000 người (khoảng 1.400 ô, layout dưới 0,3 giây) vẫn ổn với SVG, vì có các biện pháp sau:
- **Ảo hóa:** chỉ vẽ ô trong vùng nhìn thấy, cộng thêm vùng đệm 0,5 màn hình trên điện thoại, 1 màn hình trên máy tính.
- **Transform áp thẳng vào DOM:** React chỉ vẽ lại khi đổi mức chi tiết hoặc khi vùng nhìn ra khỏi vùng đã vẽ.
- **Không tô bóng khi đang kéo:** tắt bóng đổ trong lúc kéo hoặc phóng to.

Sẽ đo lại trên máy Android yếu ở giai đoạn 7; nếu giật thì đổi riêng mức L0 sang Canvas.

### D26. Trạng thái sơ đồ trên URL
Các tham số: `chi` (chi), `tu`/`den` (khoảng đời), `dr=0` (ẩn dâu-rể), `dd` (dòng dõi đang tô sáng), `v=x,y,k` (vị trí và mức phóng to, ghi sau khi ngừng kéo 0,4 giây), `f` (bay tới một người). Trạng thái thu gọn nhánh chỉ giữ trong phiên, không đưa lên URL.

### D27. Giữ chỗ nhìn khi cây đổi hình
Thu gọn nhánh hoặc lọc làm cả cây dịch chuyển. Khi đó app giữ **người gần giữa màn hình nhất** ở nguyên vị trí trên màn hình, để không bị "lạc" sang khoảng trống.

### D28. Tải Sơ đồ khi cần
Màn hình Sơ đồ và thư viện d3 nằm trong một gói riêng (khoảng 29KB gzip), chỉ tải khi mở tab Sơ đồ. Gói tải lần đầu hiện khoảng 72KB gzip, thấp hơn nhiều so với ngân sách 250KB.

---

## Giai đoạn 3c — Máy tính

### D29. Mốc chuyển sang bố cục máy tính
Mốc là **960px**. Từ đó trở lên:
- thanh điều hướng dưới chuyển thành cột bên trái (88px);
- bảng chi tiết, menu "Thêm" và bảng phím tắt mở thành **khung bên phải** (400px). Khung này không che trang: không có nền tối, không khóa cuộn, sơ đồ thu hẹp lại để nhường chỗ;
- tìm kiếm mở thành hộp thoại giữa màn hình.

Điện thoại và máy tính bảng dọc vẫn dùng bảng trượt từ dưới lên. Cùng một component `Sheet`, chỉ khác cách hiển thị; các biến CSS `--rail-w`, `--panel-w` và `--bottom-bar` điều khiển khoảng trống.

### D30. Phím tắt
- **Chung:** `/` hoặc `Ctrl+K` để tìm kiếm; `1`/`2`/`3` để chuyển Gia đình/Sơ đồ/Danh sách; `?` để xem danh sách phím tắt; `Esc` để đóng bảng đang mở.
- **Gia đình:** `↑` lên cha mẹ, `↓` xuống con đầu, `←`/`→` sang anh chị em liền kề, `Enter` mở chi tiết.
- **Sơ đồ:** `+`/`−` phóng to/thu nhỏ, `0` vừa màn hình, `H` về thủy tổ, `C` thu gọn/mở hết, `L` lọc, các phím mũi tên để di chuyển sơ đồ.

Phím tắt không chạy khi đang gõ vào ô nhập liệu. Phím tắt của từng trang cũng không chạy khi đang thao tác trong một bảng đang mở.

---

## Giai đoạn 3d — PWA, chia sẻ, trình duyệt nhúng

### D31. Service worker tự viết, không dùng Workbox
Một plugin Vite nhỏ (`build/pwa.ts`) tạo ra `sw.js` cùng danh sách file của bản build. Cách lưu và tải từng loại file:

| Loại | Cách làm |
|---|---|
| App shell, tính cả phần Sơ đồ chưa mở lần nào | Lưu sẵn khi cài |
| Trang HTML | Ưu tiên mạng, chờ tối đa 4 giây rồi dùng bản đã lưu (hợp với 4G yếu) |
| File build (JS, CSS) | Ưu tiên bản đã lưu (`ignoreVary`, vì tên file có mã hash) |
| Font Google, ảnh Firebase Storage | Trả bản đã lưu ngay, đồng thời tải bản mới về |
| Dữ liệu Firestore | Không qua service worker; dùng bộ đệm offline riêng của Firestore (IndexedDB) |

Khi có phiên bản mới, app hiện thông báo "Cập nhật" và **chỉ tải lại trang khi người dùng bấm nút**. Test e2e đã bắt được lỗi tự tải lại trang ở lần cài đầu tiên; lỗi này đã sửa. *(Đã đổi ở D53: app tự cập nhật khi mở lại.)*

### D32. Ảnh xem trước khi chia sẻ link (Open Graph)
Zalo và Facebook không chạy JavaScript khi đọc link, nên các thẻ `og:*` phải nằm sẵn trong `index.html` lúc build. Chúng được lấy từ `VITE_APP_TITLE`, `VITE_APP_DESCRIPTION` và `VITE_SITE_URL`. **Phải điền `VITE_SITE_URL`** để `og:image` là địa chỉ đầy đủ; Facebook không chấp nhận đường dẫn tương đối.

Ảnh `og-image.png` (1200×630) và các icon do `scripts/make-icons.mjs` vẽ ra. Hình là bản tự vẽ: một chấm tổ tiên, thân cây và ba chấm con cháu.

**Hạn chế:** mọi link, kể cả `/person/:id`, hiện **cùng một** ảnh và tiêu đề. Hosting tĩnh không tạo được ảnh riêng cho từng người; muốn vậy cần Cloud Functions, tức gói Blaze. Sẽ xem lại nếu cần.

### D33. Không cho Google lập chỉ mục
Mặc định có `<meta name="robots" content="noindex">` để thông tin gia đình không hiện trên kết quả tìm kiếm Google. Muốn bật thì đặt `VITE_ALLOW_INDEXING=true`. Thẻ này không ảnh hưởng đến ảnh xem trước trên Zalo/Facebook. Không chặn bằng `robots.txt`, vì một số bot đọc link xem trước tuân theo file này.

### D34. Trình duyệt nhúng (Zalo, Facebook, Messenger)
- **Nhận diện** qua user agent (`src/lib/inApp.ts`). Menu "Thêm" hướng dẫn "⋯ → Mở bằng trình duyệt" vì các trình duyệt này không cài PWA được.
- **Chịu được môi trường bị chặn:** `localStorage` báo lỗi, không có IndexedDB, không có Web Share, clipboard bị chặn. Có test e2e riêng cho trường hợp này. Khi mọi cách chia sẻ đều bị chặn, link hiện ra để người dùng tự sao chép.
- **CSS có phương án dự phòng** cho WebView cũ: `vh` trước `dvh`, màu đặc trước `color-mix`.
- **Giới hạn:** test e2e chạy bằng Chromium với user agent và kích thước của từng máy. Safari iOS thật và WebView thật của Zalo/Facebook vẫn phải thử bằng tay trên điện thoại (xem README).

### D35. Font tải song song
Font Be Vietnam Pro chuyển từ `@import` trong CSS sang thẻ `<link>` trong `<head>`, có `preconnect`. Lighthouse Mobile: Performance tăng từ 86 lên 92 (FCP từ 3,0 xuống 2,7 giây trên 4G giả lập), Accessibility 100, Best Practices 100. Việc tự host font, cần cho in PDF, để sang giai đoạn 6.

---

## Thiết kế giao diện

### D36. Chọn mẫu C "Sơn son"
Tôi đề xuất 3 mẫu thiết kế, mỗi mẫu là một bản demo bấm thử được (mã nguồn ở `design/proposals/`). Dòng họ chọn **mẫu C "Sơn son"**, và mẫu này nay là giao diện màn hình mặc định thay cho "minimal".
- **Một màu chủ đạo:** đỏ son `#a3271c`, lấy từ hoành phi và gia phả truyền thống. Màu son đậm chỉ dùng cho điểm nhấn nhỏ: nút chính, mục đang chọn, số giỗ trong tuần. Các mảng lớn dùng sắc nhạt của chính màu này: người đang xem, mục đang chọn, ngày giỗ sắp tới. Nền chính ngả nhẹ về sắc son nhạt nhất (`#fbf8f7`).
- **Font Lexend**, loại font thiết kế để dễ đọc, có bộ chữ tiếng Việt. Font Be Vietnam Pro được thay toàn bộ, cả trong ảnh xem trước khi chia sẻ link.
- **Không còn màu theo giới tính** (bỏ xanh/hồng). Tên in màu mực; dâu/rể in nhạt hơn một bậc. Trên Sơ đồ vẫn phân biệt được (SPEC 5.2): con gái trong họ là ô son nhạt, người đã mất là nền ấm hơi xám, dâu/rể ghi trong ô của người phối ngẫu. Bản đồ nhỏ dùng màu xám cho nam và màu son cho nữ.
- **Không vạch màu bên trái thẻ, không bóng đổ khi đứng yên.** Bóng chỉ còn ở những gì nổi lên trên trang: bảng trượt, hộp tìm kiếm, thẻ mở rộng trên sơ đồ.
- **Khung app:**
  - Điện thoại: thanh trên ghi tên dòng họ kèm nút tìm kiếm (không hiện ở Sơ đồ vì Sơ đồ có thanh riêng), cùng thanh điều hướng dưới.
  - Máy tính: cột trái 248px gồm tên dòng họ, số người và số đời, ô "Tìm người" (`/`), menu, mục Ngày giỗ có số giỗ trong 7 ngày tới. Bảng chi tiết bên phải rộng 380px.
- **Chế độ Gia đình:**
  - Người đang xem nằm trên nền son nhạt, kèm 3 nút: Xem chi tiết, Lên đời trước, Trên sơ đồ.
  - Ngay dưới là dải **"Ngày giỗ sắp tới"** (3 giỗ gần nhất), điểm nhận diện của mẫu.
  - Cha mẹ, vợ chồng, con (ghép theo từng bà), anh chị em đều là **danh sách dọc** (2–3 cột trên màn hình rộng). Đây là chỗ đổi so với SPEC 5A.1 ("các con xếp thành hàng cuộn ngang"): khi dùng thử, người thứ ba bị cắt nửa trông như lỗi, khó với người lớn tuổi, và dòng họ đã chọn bố cục của mẫu C.
- **Trang Ngày giỗ** (`/anniversaries`) đã có danh sách giỗ trong 60 ngày tới, mỗi dòng có tên, đời, chi, số năm đã mất, ngày dương và ngày âm (SPEC §9). Nút xuất `.ics` để sang giai đoạn 7.
- **Bản tối** được thiết kế riêng: nền nâu đen trung tính, màu son sáng hơn (`#ef8a7d`) để chữ vẫn đạt tương phản 4,5:1.
- **Kết quả đo** bằng bộ kiểm tra của skill design-taste-frontend (`--app`, ở 1440, 768 và 390px):

  | Màn hình | Lỗi (FAIL) | Cảnh báo (WARN) | Ghi chú |
  |---|---|---|---|
  | Gia đình | 0 | 0 | trước khi đổi: 1 lỗi |
  | Danh sách | 0 | 0 | trước khi đổi: 1 lỗi |
  | Sơ đồ | 0 | 0 | trước khi đổi: 3 lỗi, 1 cảnh báo |
  | Ngày giỗ | 0 | 1 | danh sách dài nên nhiều mục nằm dưới màn hình đầu, đương nhiên |

  Lighthouse Mobile: Performance 89, Accessibility 100.

---

## Giai đoạn 4 — Admin

### D37. Mỗi thao tác là một "bộ thay đổi" ghi trong một batch
`src/lib/admin/changes.ts` là phần lõi thuần, không có giao diện. Nó biến mỗi thao tác của admin thành một danh sách tài liệu cần ghi:
- **Thao tác có sẵn:** sửa, thêm con, thêm vợ/chồng, thêm cha cho thủy tổ, đổi thứ tự anh chị em, xóa, sửa cài đặt.
- **Quy tắc kiểm tra:**
  - dữ liệu được kiểm tra bằng `validators.ts`;
  - không xóa người còn con, không xóa thủy tổ;
  - "Thêm cha" chỉ áp dụng cho thủy tổ.
- **Cách ghi:** backend ghi mọi tài liệu cùng **một dòng nhật ký cho mỗi tài liệu** trong **một batch** (SPEC §3). Mọi dòng nhật ký của một thao tác có chung `groupId` và một `summary` bằng chữ, ví dụ "Thêm con của X: Y". Rules được mở rộng để chấp nhận hai trường này.
- **Khi sửa:** chỉ ghi các trường có trong bản mới và xóa (`deleteField`) các trường bị bỏ, để giữ `createdAt` như rules yêu cầu.

Các tình huống cụ thể:
- **Thêm con cho người chưa có hôn nhân:** tạo hôn nhân với "vợ/chồng chưa rõ".
- **Thêm vợ/chồng:** nếu có hôn nhân đang để trống tên người phối ngẫu thì điền vào đó, ngược lại tạo hôn nhân mới với `order` kế tiếp.
- **Xóa người trong họ:** xóa luôn hôn nhân của người đó, và người phối ngẫu nếu không còn hôn nhân nào khác.
- **Xóa dâu/rể:** hôn nhân nào còn con thì giữ lại, chỉ để trống tên người phối ngẫu.

### D38. Hoàn tác an toàn
Hoàn tác đảo ngược **cả nhóm** của một thao tác. Trước khi làm, app kiểm tra mỗi tài liệu hiện vẫn đúng như sau thao tác đó. Nếu đã có người sửa tiếp thì app **từ chối**, để không làm mất thay đổi mới hơn. Bản thân thao tác hoàn tác cũng được ghi vào nhật ký, nên hoàn tác được tiếp.

### D39. Hai backend, một giao diện lập trình
`AdminBackend` có hai bản:
- **Firebase:** Auth email/mật khẩu, phiên lưu theo tab (`browserSessionPersistence`), kiểm tra quyền bằng cách đọc `config/admins`, ghi theo batch, ảnh lưu trên Storage.
- **Demo:** chạy trong bộ nhớ cho bản xem thử, mã `ma-admin-demo`, ảnh lưu dạng data URL, mất khi tải lại trang. Riêng validator chấp nhận `data:image/` cho bản demo; rules Firebase vẫn chỉ nhận `https://`.

Test bảo mật chạy chính hàm `writeChangeSet` của bản Firebase trên emulator. Kết quả: admin ghi được mọi thao tác và hoàn tác được; người không có quyền bị chặn và không có gì được ghi.

### D40. Phiên admin
Đăng nhập xong, app còn kiểm tra UID có trong `config/admins`. Đúng mã nhưng không có quyền thì tự đăng xuất và báo rõ.
- **Tự thoát sau 30 phút không thao tác** (nhấn, gõ phím, cuộn). Thời điểm thao tác cuối được lưu trong `sessionStorage`, nên tải lại trang cũng không kéo dài được phiên.
- Đóng tab thì phiên kết thúc.
- Khi đang là admin, thanh "Đang ở chế độ Admin · Thoát" luôn hiện: dưới thanh trên trên điện thoại, cuối cột trái trên máy tính, và ở đầu trang Sơ đồ.

### D41. Giao diện admin
- **Cách mở thao tác:**
  - nhấn giữ 0,55 giây vào một người (điện thoại, SPEC 5A.2);
  - nút "Thao tác (Admin)" trên thẻ người đang xem;
  - nút "Sửa thông tin" và "Thao tác khác…" trong bảng chi tiết.
- **Form người:**
  - toàn màn hình trên điện thoại, khung bên phải trên máy tính;
  - chia 5 nhóm: Cơ bản, Tên khác, Ngày sinh, Ngày mất và giỗ, Thông tin khác;
  - ngày tháng cho phép nhập riêng năm, hoặc năm và tháng; tự gợi ý ngày âm từ ngày dương và ngược lại; ngày giỗ gợi ý theo ngày mất âm lịch.
- **Ảnh:**
  - thu nhỏ ngay trên máy thành 800px và 120px dạng JPEG trước khi tải lên (SPEC §4);
  - chọn từ máy ảnh hoặc thư viện (không ép dùng máy ảnh);
  - nút tải ảnh tự ẩn nếu project chưa bật Storage (D8).
- **Hiển thị lớp trên cùng:** các bảng admin luôn nằm trên bảng chi tiết. Lỗi form bị che phía dưới đã được phát hiện khi thử bằng trình duyệt thật và đã sửa.
- **Tải khi cần:** phần admin chỉ tải khi admin mở một bảng hoặc vào trang quản trị. Người xem không tải thêm gì.
- **Nhập/xuất Excel và JSON** để sang giai đoạn 7, như kế hoạch.

## Giai đoạn 5 — Theme và in theo chi

### D42. Hệ thống theme
- Mỗi theme là một thư mục `src/themes/<id>/` gồm `theme.ts` (theo interface `Theme` của SPEC §8) và thư mục `ornaments/` chứa các file SVG tự vẽ.
- `registry.ts` tự tìm mọi theme bằng `import.meta.glob`. **Thêm theme mới chỉ cần thêm một thư mục**, không phải sửa code ở chỗ khác.
- Hoa văn SVG được nhúng thẳng vào bản in (không tải từ mạng), nên khi xuất PDF/SVG ở giai đoạn 6 không bị thiếu hình.
- Theme `son-son` là giao diện màn hình đã chọn (D36). Tên cũ `minimal` vẫn dùng được, trỏ sang `son-son`.

### D43. Bốn theme in để duyệt
SPEC có 3 theme. Tôi làm thêm một theme thứ tư, **Men lam** (lam trắng gốm Chu Đậu), để người dùng có 4 lựa chọn và chọn 2:

| Theme | Phong cách | Font |
|---|---|---|
| Truyền thống đỏ | nền kem, viền hồi văn đỏ, băng rôn cuộn thư, cành mai | Noto Serif, Noto Serif Display |
| Sơn mài vàng | nền nâu đen, viền vàng ánh kim, mây, núi, hoa sen | Playfair Display, Lora, Dancing Script |
| Giấy dó mực tàu | nền giấy dó, mực đen, núi thủy mặc, trúc, con dấu đỏ | Cormorant Garamond |
| Men lam | nền trắng ngà, lam cobalt, viền dây leo, hồ sen | Prata, Literata |

- Mọi font đều hỗ trợ đủ dấu tiếng Việt và có giấy phép OFL.
- **Người dùng chọn giữ cả 4 theme.** Cả 4 đều có trong trang In, trang Giao diện in và nút đổi giao diện trên sơ đồ.

### D44. In theo chi (rẽ nhánh)
- **Yêu cầu:** in chi của ông A (ví dụ ở đời 3) thì bản in gồm:
  - mọi người từ thủy tổ xuống tới ông A;
  - toàn bộ con cháu của ông A;
  - anh chị em của ông A và các nhánh khác vẫn hiện, nhưng **con cháu của họ được thu gọn**, chỉ ghi "+N con cháu".
- **Cách làm:** thêm `focusId` vào bộ lọc sơ đồ. Chỉ mở những người nằm trên đường thủy tổ → A và mọi hậu duệ của A; những người khác coi như "thu gọn". Bố cục sơ đồ màn hình và bản in dùng chung một hàm.
- Chọn vợ hoặc chồng của A thì cho ra cùng chi của A.
- **Cách chọn chi để in:**
  - trang **In gia phả**: ô "Phạm vi in" (toàn bộ, hoặc theo chi, nhóm theo đời);
  - trong bảng chi tiết một người có con: link "In gia phả theo chi của …".
- Bản in có thêm dòng "Chi ông … (đời …): đầy đủ con cháu; các nhánh khác thu gọn".

### D45. Bố cục poster A1
- Khổ A1 tính bằng mm (841×594 ngang).
- Thứ tự từ trên xuống: tiêu đề (băng rôn), phụ đề, dòng thủy tổ, dòng chi; câu đối dọc hai bên; dải màu xen kẽ theo đời; lạc khoản ở góc dưới.
- **Cây rộng mà ít đời:** khi chiều ngang giới hạn tỷ lệ, poster kéo giãn khoảng cách giữa các đời (ô người giữ nguyên kích thước) cho kín chiều cao giấy, không để trống nửa trang.
- Tự co chữ, đặt ô dọc và xuất PDF/SVG/PNG thuộc giai đoạn 6.

### D46. Đổi giao diện ngay trên sơ đồ
- Nút **Giao diện** trên thanh công cụ của Sơ đồ (SPEC 5.1 "Chọn theme"). Có 5 lựa chọn: Sơn son (mặc định) và 4 theme in.
- **Chỉ đổi màu và kiểu chữ:**
  - đổi màu nền, ô, đường nối, dải đời, màu tên nam/nữ/dâu-rể, và font tên;
  - không vẽ khung, hoa văn hay câu đối trên màn hình, vì SPEC 5 ưu tiên đọc rõ, không mô phỏng khung tranh;
  - thanh công cụ và thanh điều hướng giữ giao diện Sơn son, để nút bấm luôn dễ thấy.
- Lựa chọn được nhớ trên từng máy (localStorage).
- **Hiệu năng:** danh sách theme và hoa văn chỉ tải khi mở bảng chọn hoặc khi đang dùng một theme in. Người dùng Sơn son không tải thêm gì.
- **Theme in mặc định:** trang In chọn theme theo thứ tự:
  1. tham số `?giaodien=`;
  2. theme đang dùng trên sơ đồ;
  3. "Giao diện in mặc định" trong Cài đặt dòng họ;
  4. Truyền thống đỏ.
- Trang Giao diện in có thêm 2 nút cho mỗi theme: "In với giao diện này" và "Dùng cho sơ đồ".
- **Sửa lỗi cũ:** trên máy tính, sơ đồ bị bó trong cột giữa rộng 46rem, vì quy tắc căn giữa nội dung trang cũng áp vào sơ đồ. Giờ sơ đồ chiếm hết chiều ngang. Lỗi lộ ra khi đổi nền theme.

## Dữ liệu thật: sổ gia phả họ Trịnh

### D47. Nhiều gia đình cùng ở đời 1
- Sổ gia phả bắt đầu từ "đời III" (9 gia đình) và chưa ghi tổ tiên đời I, II. Người dùng chọn **đánh số lại từ Đời 1**: đời III của sổ là Đời 1 trong app, đời IV là Đời 2, đời V là Đời 3.
- **Quy ước mới:** mọi người huyết thống không có cha mẹ đều là "người đứng đầu" (founder), thuộc đời 1 như thủy tổ. `settings.rootPersonId` vẫn là một trong số đó (gia đình đầu tiên trong sổ).
- Không cần đổi cấu trúc Firestore và Security Rules. Người đứng đầu có `birthOrder` theo thứ tự trong sổ để sắp xếp ổn định.
- Phần còn lại giữ nguyên: số đời vẫn tính từ cha mẹ, không lưu.
- Sơ đồ, bản in và danh sách chi in đều xuất phát từ tất cả người đứng đầu. Bản in ghi "Gồm N gia đình ở đời 1" thay cho dòng "Thủy tổ".
- **Con của con gái là bên ngoại** (ẩn trên cây nếu tắt tùy chọn). Dòng họ này bật `showMaternalDescendants`, vì sổ ghi cả con cháu bên ngoại.
- Chuyển đổi từ sổ: `src/lib/import/giaPhaSo.ts`. Test dùng sổ hư cấu `tests/fixtures/book-sample.json`.
- **Dữ liệu thật không nằm trong Git** (repo công khai): chỉ ở `private-data/ho-trinh.json` trên máy quản trị (thư mục này trong `.gitignore`) và trong Firebase. Người xem đọc từ Firebase qua giao diện web.

### D48. Mở rộng đời ở cả hai chiều
- **Xuống dưới:** Thêm con vẫn như cũ. Đời thứ 4 hiện sẵn dưới dạng dòng trống "đang cập nhật" (tối thiểu 4 đời trên sơ đồ đầy đủ, `MIN_GENERATIONS` trong `layout.ts`). Tiêu đề sơ đồ chỉ đếm đời có người.
- **Lên trên:** "Thêm cha" dùng được ở mọi người đời 1. Khi có nhiều gia đình đời 1, người cha mới trở thành **cha chung** của tất cả. Số đời của mọi người cùng lùi một đời, nên số đời luôn nhất quán. Hoàn tác như các thao tác khác (một nhóm thay đổi).
- Muốn gắn riêng một gia đình dưới tổ tiên khác thì chưa làm. Chờ người nhà xác nhận quan hệ giữa các gia đình.

### D49. Giới tính và chỗ chưa chắc
- Sổ không ghi giới tính. Quy ước: "Thị" trong tên là nữ, "Văn" là nam. Các tên còn lại được xếp thủ công theo tên và giới tính của vợ/chồng.
- Người nào suy đoán yếu có ghi chú "Cần xác nhận: giới tính suy từ tên". Bảng giới tính nằm trong file dữ liệu riêng.
- Chữ khó đọc và chỗ bị làm mờ trong sổ nằm ở phần Ghi chú của từng người, kèm số trang sổ cho người đứng đầu.
- Chỗ sổ ghi mơ hồ về cha mẹ được đặt theo đúng sổ và có ghi chú nêu khả năng khác; chờ người nhà xác nhận.
- Chưa có ngày sinh, ngày mất, câu đối, lạc khoản: để trống để admin nhập.

### D50. Nút "Thêm đời trên / dưới"
- Các thao tác thêm đời trước đây nằm sâu trong menu của từng người. Giờ admin có nút **Thêm đời trên / dưới** ngay trên Sơ đồ và ở trang Quản trị.
- Bảng "Thêm đời" có hai phần:
  - **Phía trên:** thêm một tổ tiên làm cha chung của mọi gia đình ở Đời 1 (D48).
  - **Phía dưới:** chọn cha hoặc mẹ (danh sách nhóm theo đời, mặc định đời sâu nhất) rồi mở form Thêm con. Con của người ở đời cuối mở ra đời mới.
- Sửa thông tin từng người vẫn như cũ: chạm vào người đó → Sửa thông tin / Thao tác khác.

## Thiết kế giao diện: Ember

### D51. Đổi giao diện màn hình sang "Ember" (thay D36 "Sơn son")
- Theo bảng thiết kế **EMBER / SYSTEM** người dùng gửi.
- **Bảng màu giữ nguyên mã:**
  - Burnt Sienna `#BD5F3C`, Terracotta `#D67A53`, Amber `#F6A14B`;
  - Sandy Cream `#F5E6D3`, Charcoal `#333333`, Warm Gray `#777777`.
  - Các mã này nằm trong `src/styles.css` dưới dạng biến cùng tên (`--burnt-sienna`…).
- **Chữ:** Inter (có bộ ký tự tiếng Việt), thay Lexend.
- **Hình khối:**
  - nền kem ấm `#F5F0E9`, thẻ màu kem sáng;
  - bo góc 16px cho thẻ, 22px cho thẻ header và bảng trượt, 10px cho nút, viên thuốc cho chip;
  - đổ bóng mềm màu nâu ấm. Sơn son trước đây không dùng bóng.
- **Thành phần:**
  - **Thẻ header** (người đang xem ở màn Gia đình): gradient sienna, chữ trắng. Nút bên trong đảo màu: nền kem, viền trắng.
  - **Nút:** Primary nền sienna, chữ trắng; Secondary viền sienna trên nền kem. Nút phụ ở cuối bảng dùng trạng thái "Default" (nền kem).
  - **Thanh điều hướng:** tab đang chọn có nền Sandy Cream sau biểu tượng.
  - Ô chọn và thanh trượt của trình duyệt dùng `accent-color` sienna.
- **Chỉnh nhỏ để đạt WCAG AA (SPEC yêu cầu):**
  - chữ trắng trên `#BD5F3C` chỉ đạt 4,32:1. Chữ và nút dùng sienna đậm hơn một bậc `#A9532F` (5,3:1); `#BD5F3C` dùng cho mảng lớn, biểu tượng và icon app;
  - Warm Gray `#777777` trên nền trắng đạt 4,48:1, nên chữ phụ dùng `#6B625B` (≥ 4,8:1 trên mọi nền kem);
  - gradient header đi từ `#A04B2A` đến `#B85A36`, chữ trắng ≥ 4,6:1.
- **Chế độ tối:** dựng từ Charcoal, giữ cùng tinh thần (sienna sáng `#F0A47E` cho chữ nhấn).
- **Theme trên sơ đồ:** tên mới là `ember`. `son-son` và `minimal` vẫn được nhận và tự đổi sang `ember`.
- Biểu tượng app, favicon và ảnh xem trước khi chia sẻ link đã vẽ lại theo màu Ember.

### D52. Chỉ một giao diện màn hình; gọn thanh điều hướng
- **Màn hình chỉ dùng Ember sáng.**
  - Bỏ chế độ tối và lựa chọn "Theo máy / Sáng / Tối". App giữ màu Ember kể cả khi điện thoại hay máy tính đang ở chế độ tối.
  - Bỏ nút "Giao diện" trên Sơ đồ và nút "Dùng cho sơ đồ" ở trang Giao diện in: sơ đồ trên màn hình luôn là Ember.
  - Các theme còn lại (Truyền thống đỏ, Sơn mài vàng, Men lam, Giấy dó) chỉ dùng cho bản in, chọn ở `/themes` và `/print`.
- **Điều hướng:**
  - Bỏ mục "Gia đình" khỏi thanh bên và thanh dưới. Màn này vẫn là trang đầu: bấm tên dòng họ ở đầu trang, hoặc mở từ kết quả tìm kiếm hay nút "Gia đình" trên hồ sơ.
  - Mục "Thêm" đổi thành "Cài đặt" (icon bánh răng); trên máy tính nó nằm ngay dưới Ngày giỗ.
  - Ô "Tìm người" đổi thành "Tìm kiếm".
  - Phím tắt: 1 Sơ đồ, 2 Danh sách, 3 Ngày giỗ.

### D53. Tự cập nhật phiên bản mới khi mở lại app (thay một phần D31)
- **Vấn đề:** điện thoại giữ app mở chạy nền nhiều ngày. Bản mới đã deploy nhưng không ai bấm "Cập nhật", nên điện thoại vẫn hiện giao diện cũ.
- **Cách làm (`src/app/pwa.ts`):**
  - Mỗi khi app hiện lại trên màn hình, app hỏi xem có bản mới không (`reg.update()`).
  - Khi có bản mới, app tự tải lại nếu không làm mất gì của người dùng:
    - app vừa mở hoặc vừa hiện lại (trong 15 giây), hoặc
    - app đang chạy nền (người dùng đã rời đi; lần quay lại sẽ thấy bản mới).
  - **Không tự tải lại khi đang mở bảng sửa của admin.** Khi đó thông báo "Cập nhật" vẫn hiện để bấm tay.
- Vẫn giữ điều D31 đã sửa: lần cài service worker đầu tiên không tải lại trang.

### D54. "Cây dọc": bố cục Sơ đồ cho điện thoại
- **Vấn đề:** cây gia phả rộng theo chiều ngang, mỗi đời lại đông hơn đời trước. Với dữ liệu thật (48 người, 4 đời), sơ đồ rộng khoảng 14.000px nhưng chỉ cao 640px. Điện thoại dọc thì ngược lại: hẹp và cao. Ở mức đọc được, mỗi hàng chỉ thấy khoảng 1,5 người; bấm "Vừa màn hình" thì chữ chỉ còn khoảng 1px.
- **Cách làm:** thêm bố cục **Cây dọc** (`src/features/tree/outline.ts`, `OutlineView.tsx`). Mỗi đời thụt vào 20px, anh chị em xếp nối nhau theo chiều dọc, có đường nối như cây thư mục. Chỉ cần cuộn dọc bằng một ngón tay và không cần zoom.
  - Mỗi dòng gồm thứ tự con (I, II…), họ tên, năm sinh–mất, tên vợ/chồng; cao tối thiểu 52px.
  - Mặc định mở 2 đời. Nhánh đang đóng có huy hiệu "+N". Mũi tên tròn bên trái để mở/đóng nhánh; chạm tên để mở bảng chi tiết.
  - Thanh dòng dõi dính trên đầu (ví dụ "Chín › Thị Hai › Phong Phẩm") cho biết đang xem nhánh nào; chạm một mục để cuộn về người đó.
  - Các nhánh đang mở được nhớ trong phiên (sessionStorage).
- **Dùng chung với sơ đồ ngang:** cùng tham số URL (`chi`, `tu`, `den`, `dr`, `dd`, `f`, `ct`; xem `useTreeParams.ts`) và cùng quy tắc lọc (`layout.ts`). Nhờ vậy tìm kiếm, "Trên sơ đồ", "Xem dòng dõi" và link chia sẻ đều chạy ở cả hai bố cục. Tìm một người thì nhánh của họ tự mở, rồi cuộn tới và tô sáng.
- **Chọn bố cục:**
  - `xem=doc|ngang` trên URL.
  - Nếu không có, dùng lựa chọn gần nhất trên máy (`treeLayout` trong prefs).
  - Nếu chưa chọn bao giờ: điện thoại (< 960px) dùng Cây dọc, máy tính dùng sơ đồ ngang.
  - Nút chuyển nằm trên thanh công cụ của cả hai bố cục.
- Màn Sơ đồ trên điện thoại không có thanh tiêu đề chung, nên dòng "Admin · Thoát" (D52) được đặt ngay trong đầu của cả hai bố cục.
- **Chưa làm:** ảo hóa danh sách. Danh sách thường vẫn mượt với vài trăm dòng; khi gia phả lên tới hàng nghìn người thì cần làm.

### D55. Bỏ màn Danh sách; công tắc Dọc/Ngang; bộ lọc thông minh
*(Phần "bộ lọc thông minh" đã bỏ ở D56.)*
- **Bỏ "Danh sách":** Cây dọc (D54) đã làm thay việc xem theo đời và nhánh.
  - Thanh dưới của điện thoại giờ giống sidebar trên máy tính: **Sơ đồ · Ngày giỗ · Tìm kiếm · Cài đặt**. Ngày giỗ có số ngày giỗ trong 7 ngày tới, như trên sidebar.
  - Link cũ `/danh-sach` mở Cây dọc.
  - Phím tắt: 1 = Sơ đồ, 2 = Ngày giỗ.
- **Công tắc Dọc / Ngang** (`LayoutToggle.tsx`): một công tắc 2 nấc ở đầu màn Sơ đồ, có ở cả hai bố cục. Lựa chọn được nhớ trên từng máy (D54).
- **Bộ lọc thông minh** (`smartFilter.ts`, `FilterBar.tsx`, `TreeFilterSheet.tsx`):
  - **Ô "Lọc theo tên" ngay trên đầu sơ đồ:** gõ là cây thu hẹp ngay, không cần dấu, khớp cả tên húy/tự/hiệu. Gõ tên vợ/chồng thì hiện dòng của người trong họ.
  - **Bảng Bộ lọc dùng chip lớn, dễ chạm:**
    - Ngày giỗ sắp tới (7 / 30 ngày), Tình trạng (còn sống / đã mất), Giới tính;
    - **Đời:** chạm một số để chọn một đời, chạm số khác để chọn cả khoảng;
    - Chi; công tắc dâu/rể và bên ngoại.
    - Bộ lọc áp dụng ngay, cây phía sau đổi theo. Nút cuối bảng báo số người khớp ("Xem 12 người khớp").
  - **Cách hiện kết quả:** chỉ giữ người khớp và dòng tổ tiên dẫn tới họ, để vẫn thấy họ thuộc nhánh nào.
    - Người khớp được tô màu; tổ tiên làm mờ.
    - Cây dọc tự mở hết các nhánh có người khớp. Sơ đồ ngang bỏ thu gọn và tô sáng người khớp.
  - **Mỗi bộ lọc đang bật hiện thành một chip** dưới ô lọc, bấm ✕ để bỏ từng cái, hoặc bấm "Xóa tất cả".
  - Tham số URL: `q`, `tt=song|mat`, `gt=nam|nu`, `gio=7|30`. Link chia sẻ giữ nguyên bộ lọc.
- Sơ đồ ngang chừa 128px phía trên cho thanh đầu 2 hàng (`TOP_SPACE`), để thanh đầu không che thủy tổ khi mới mở.

### D56. Bộ lọc tối giản: chỉ chọn khoảng đời
- Theo yêu cầu, Sơ đồ chỉ còn **một** bộ lọc: hiện từ đời nào đến đời nào, chọn trên **một thanh trượt hai đầu** (`GenRangeSlider.tsx`). Thanh trượt nằm ngay trên đầu sơ đồ, ở cả Cây dọc lẫn sơ đồ ngang, không cần mở bảng nào.
  - Đầu trái là "Từ đời", đầu phải là "Đến đời"; hai đầu không vượt qua nhau. Nút tròn 28px, dễ kéo bằng ngón tay.
  - Phía trên thanh có dòng tóm tắt ("Tất cả 4 đời", "Đời 2 – 4") và nút "Hiện tất cả". Dưới thanh có số thứ tự các đời.
  - Hai ô `input type="range"` gốc dùng chung một rãnh, nên dùng được bằng chạm, chuột, bàn phím và trình đọc màn hình.
  - Vẫn dùng tham số URL `tu` / `den`. Chọn hết các đời thì bỏ tham số.
- **Đã bỏ:** ô "Lọc theo tên", bảng Bộ lọc, lọc theo ngày giỗ / tình trạng / giới tính / chi, công tắc dâu-rể, chip bộ lọc, phím tắt L. Sơ đồ luôn hiện dâu/rể.
  - "Hiện con cháu bên ngoại" vẫn còn, nhưng là một cài đặt (trong Cài đặt), không phải bộ lọc.
  - Muốn tìm một người thì dùng nút Tìm kiếm: chọn người là nhánh của họ tự mở ra.
  - Link cũ có `chi`, `dr`, `q`… vẫn mở được; các tham số đó bị bỏ qua.
- **Đầu trang chỉ một hàng:** [Đời 1–4 ●━━●] [Dọc | Ngang] [Mở hết], ở cả hai bố cục.
  - Trên màn hẹp hơn 560px, công tắc chỉ hiện icon (vẫn có nhãn "Dọc"/"Ngang" cho trình đọc màn hình).
  - Thanh trượt rộng tối đa 420px.
  - Tiêu đề "Sơ đồ" chỉ còn cho trình đọc màn hình, vì thanh dưới đã ghi tên tab. Số "48 người · 4 đời" nằm ở dòng nhỏ dưới hàng điều khiển; khi cuộn xuống, dòng này thành thanh dòng dõi. Trên điện thoại, dòng chữ Admin cũng nằm ở dòng này.
  - Sơ đồ ngang chừa 84px phía trên (`TOP_SPACE`).

### D57. Bỏ màn "Gia đình"; hồ sơ gọn lại
- **Bỏ màn Gia đình** (một người ở giữa, cha mẹ ở trên, các con ở dưới). Thông tin này trùng nhiều với Cây dọc và với thẻ "Gia đình" trong hồ sơ.
  - Trang đầu `/` mở **Sơ đồ**.
  - Link cũ `/?p=id` (và `ct`) chuyển sang `/so-do?f=id`: nhánh của người đó tự mở và cây cuộn tới họ.
  - **Tìm kiếm** ở bất kỳ màn nào cũng chuyển sang Sơ đồ và đi tới người được chọn (`useOverlays().goToPerson`). Xóa một người đang xem thì chuyển tới cha/mẹ của họ trên Sơ đồ.
  - Bỏ các phím mũi tên của màn Gia đình.
- **Hồ sơ** (bảng chi tiết và trang `/nguoi/:id`):
  - Bỏ các nút "Gia đình", "Trang cá nhân", "Chia sẻ", "Dòng dõi".
  - Bỏ dòng thống kê "1 vợ · 2 con · 6 con cháu".
  - Chỉ admin còn nút ("Sửa hồ sơ", "Thêm con, vợ/chồng…"). Cha mẹ, vợ/chồng, con và anh chị em vẫn nằm trong thẻ "Gia đình" của hồ sơ.
  - Chia sẻ cả gia phả vẫn dùng nút "Chia sẻ gia phả này" trong Cài đặt. Link `/nguoi/:id` cũ vẫn mở được trang hồ sơ.
- Tham số `dd` (tô sáng dòng dõi) vẫn đọc được từ link cũ, nhưng không còn nút để bật.

### D58. Bảng hồ sơ trên máy tính rộng hơn, chữ gọn hơn
- Bảng bên phải trên máy tính (hồ sơ, Cài đặt, phím tắt) rộng **456px**, tức 380px + 20% (`--panel-size` trong `styles.css`).
- Hồ sơ trong bảng này (`Profile.module.css`, chỉ áp dụng từ 960px; điện thoại giữ nguyên) dùng chữ nhỏ hơn một bậc, để thông tin nằm trên một dòng thay vì xuống nhiều dòng:
  - tên 1.375rem; tiêu đề thẻ 1rem;
  - các mục Sinh / Quê quán / An táng / Nghề nghiệp 0.875rem, xếp bao nhiêu cột vừa thì xếp. Một mục đứng riêng (ví dụ "Con của TRỊNH VĂN CHÍN (thứ I)") chiếm cả chiều rộng.
  - Mỗi dòng người trong thẻ Gia đình: tên và năm sinh–mất nằm trên một dòng. Tên quá dài thì cắt bằng "…" chứ không xuống dòng.

### D59. Nút và chip của admin trong hồ sơ: gọn, cùng một kiểu
- **Đầu hồ sơ:** hai nút bằng nhau trên một hàng, không gãy dòng kể cả ở màn 360px: **"Sửa hồ sơ"** (nút chính) và **"Thêm người thân"** (mở menu thêm con / vợ, chồng / cha…). Tên cũ "Thêm con, vợ/chồng…" dài nên bị gãy dòng.
- **Nút sửa ở góc mỗi thẻ:** một nút tròn 36px chỉ có bút chì (tên cho trình đọc màn hình vẫn là "Sửa: …"), không chen vào tiêu đề thẻ.
- **Thông tin còn thiếu** gom thành một hàng chip nền nhạt, cách phần trên bằng một đường đứt:
  - thẻ Giới thiệu: **"Bổ sung: [+ Ngày sinh] [+ Nơi sinh] [+ Nơi an táng] [+ Nghề nghiệp] [+ Tiểu sử]"**, chỉ hiện mục còn trống;
  - thẻ Gia đình: **"Thêm: [+ Con] [+ Vợ/Chồng]"**.
  - Chữ trên chip ngắn, nhưng tên cho trình đọc màn hình vẫn đủ ("Thêm nơi an táng", "Thêm con"…). Thành phần `AddRow` trong `Profile.tsx`.

### D60. Ảnh đại diện trống: hình người màu xám
- Người chưa có ảnh hiện **hình người màu xám** (đầu và vai, nền #E4E6E9, hình #B0B5BB), như trên các mạng xã hội. Trước đây là chữ cái đầu của tên trên nền màu.
- Dùng chung cho mọi nơi có ảnh đại diện: dòng cha/mẹ/vợ chồng trong hồ sơ, trang Ngày giỗ, đầu hồ sơ người ngoài họ. Ai cũng cùng một màu, không phân biệt giới tính hay dâu/rể.
- **Đầu hồ sơ** cũng dùng hình người xám khi chưa có ảnh (trước là dấu tròn "Đời N"). Đầu hồ sơ không hiện số đời nữa, cũng không ghi "Chưa rõ năm sinh": khi không biết năm sinh–mất thì bỏ trống dòng đó.
- Dòng thủy tổ ở gốc Cây dọc vẫn giữ dấu "Đời 1" (`OutlineView.tsx`).

### D61. Không hiện "Sổ gia phả, trang N" trong hồ sơ
- Lúc nhập từ sổ gia phả (`src/lib/import/giaPhaSo.ts`), mỗi người được ghi thêm câu "Sổ gia phả, trang N." vào **Ghi chú**. Câu này hiện ra ở mục Tiểu sử của hồ sơ và không có ích cho người xem.
- **Hiển thị:** `visibleNotes()` (`src/lib/format.ts`) bỏ câu đó khi hiện ghi chú, ở cả hồ sơ và thẻ người trên sơ đồ ngang. Nếu ghi chú chỉ có mỗi câu đó thì coi như chưa có tiểu sử. Admin sẽ thấy chip "+ Tiểu sử".
- **Nhập dữ liệu:** lần nhập sau không ghi số trang vào ghi chú nữa.
- **Dữ liệu cũ trên Firebase vẫn giữ nguyên câu này.** Admin vẫn thấy nó trong ô Ghi chú khi sửa hồ sơ, và có thể tự xoá nếu muốn.

### D62. Cài đặt gọn lại; trang "In ấn" với gói khung tranh; mở hoặc khóa quyền chỉnh sửa
- **Cài đặt** chỉ còn: **In ấn**, **Chế độ Admin**, Chữ lớn, Hiện con cháu bên ngoại, và thẻ cài app khi cần.
  - Bỏ nút "Chia sẻ gia phả này" và mục "Ngày giỗ" (Ngày giỗ đã có trên thanh điều hướng).
  - Bỏ trang "Kiểm tra dữ liệu" (`/kiem-tra` chuyển về Sơ đồ).
- **In ấn** (`/print`) gộp "Giao diện in" và "In khổ A1":
  - lưới thẻ chọn giao diện có ảnh xem trước (gồm cả gói đã nhập);
  - phạm vi in, hướng giấy, các tùy chọn hiển thị, bản xem trước A1.
  - Link cũ `/themes` chuyển sang `/print`.
- **Gói giao diện khung tranh** (`src/features/print/packs.ts`):
  - Mỗi gói gồm **một ảnh khung khổ A1** và **một file JSON preset**, khoá tiếng Việt cho dễ sửa: `ten`, `moTa`, `nen` (giao diện gốc để lấy màu và chữ còn thiếu), `hinhNen.tep` / `hinhNen.cachPhu`, `huongGiay`, `vungNoiDungMm` (vùng trống trong khung để đặt tiêu đề và cây), `mau`, `chu`, `oNguoi`, `duongNoi`, `hienCauDoi`, `mauConTrien`.
  - Nút **"Tải JSON mẫu"** tải về `goi-giao-dien-mau.json`, trong đó có phần hướng dẫn `_huongDan`.
  - **"Nhập gói giao diện"**: chọn cùng lúc file JSON và ảnh. Ảnh cũng có thể nhúng sẵn trong JSON dưới dạng `data:image/...`.
  - Lỗi trong JSON được báo bằng tiếng Việt, nói rõ trường nào sai.
  - Gói được **lưu trên máy đang dùng** (IndexedDB), không đưa lên cơ sở dữ liệu.
  - Trên bản in, ảnh phủ cả tờ giấy và thay cho khung vẽ sẵn; tiêu đề và cây đặt trong `vungNoiDungMm` (`Theme.backgroundImage`, `contentInsetMm`, `preferredOrientation`).
- **Quyền chỉnh sửa** (Admin → "Quyền chỉnh sửa"):
  - **Khóa**: chỉ admin có mật khẩu được sửa. Đây là mặc định.
  - **Mọi người được chỉnh sửa**: ai mở app cũng thêm, sửa người và đổi ảnh được, không cần mật khẩu. Lịch sử ghi người sửa là `khach`, hoàn tác được. Trên app hiện dòng nhỏ "Mọi người đang được chỉnh sửa".
  - Cài đặt dòng họ, lịch sử, mật khẩu và chính quyền này vẫn chỉ admin đổi được.
  - Lưu trong `settings.openEditing` (`useCanEdit()` trong `adminStore.ts`).
  - **Cần deploy lại `firestore.rules`**, vì luật kiểm tra cài đặt phải nhận thêm trường `openEditing`. Nếu chưa deploy, admin sẽ không lưu được lựa chọn này.
  - Lưu ý bảo mật: như ghi chú đầu file `firestore.rules`, máy chủ vốn đã cho mọi người ghi (khoá admin chỉ nằm trên trang web). Quyền này chỉ hiện hoặc ẩn các nút sửa trong app.

### D63. "Cột vợ chồng": thẻ dọc có cả vợ/chồng
- **Vấn đề:** thẻ ngang (rộng 176) ghi được vợ/chồng nhưng chiếm nhiều chiều ngang. Thẻ dọc (rộng 56, từ đời 4) thì gọn nhưng bỏ mất vợ/chồng.
- **Cách làm:** giữ thẻ dọc rộng 56, nối dài **xuống dưới** trong cùng một thẻ. Cây gia phả thiếu chiều ngang chứ không thiếu chiều cao.
  - Phần trên: thứ tự con (I, II…), họ tên mỗi chữ một dòng, năm sinh–mất (như cũ).
  - Một **đường gạch đứt** ngăn cách, rồi phần dưới **nền nhạt hơn** (`--spouse-soft`): chữ nhỏ "vợ" / "chồng" / "vợ hai"…, rồi tên vợ/chồng mỗi chữ một dòng, chữ nhỏ hơn và màu dâu/rể.
  - Nhiều vợ/chồng thì mỗi người một phần, xếp tiếp xuống dưới.
  - Ở mức xa nhất (L0) không vẽ phần nền và đường ngăn; ở L1 chỉ hiện tên, chưa hiện "vợ"/năm.
- Vị trí từng dòng tính ở một chỗ (`verticalMetrics` trong `layout.ts`), dùng chung cho sơ đồ trên màn hình và bản in A1. Bản in vẫn theo tùy chọn "Hiện vợ/chồng" và "Hiện năm".
- Đời 1–3 vẫn dùng thẻ ngang (ít người, có chỗ ghi đủ).

### D64. Lựa chọn thứ hai: "Vợ chồng nằm cạnh nhau" (so le)
- Cài đặt **"Vợ chồng nằm cạnh nhau"** (công tắc trong Cài đặt, nhớ trên từng máy; trên link có thể ghi `vc=canh` hoặc `vc=duoi`). Mặc định vẫn là kiểu D63 (vợ/chồng nằm dưới, trong cùng thẻ).
- Khi bật, từ đời 4 trên sơ đồ ngang:
  - Thẻ người trong họ giữ nguyên (rộng 56: thứ tự, tên mỗi chữ một dòng, năm sinh–mất).
  - Mỗi vợ/chồng có **thẻ riêng rộng 58, đặt bên phải, thấp hơn 24 và nằm lấn sau thẻ chính 6**, như hai tấm thẻ đặt so le. Nền nhạt (`--spouse-soft`), chữ nhỏ "vợ"/"chồng", tên mỗi chữ một dòng. Nhiều vợ/chồng thì xếp tiếp sang phải.
  - Đường từ cha mẹ đi vào **giữa thẻ chính**; đường xuống các con **đi ra từ chỗ giáp giữa hai vợ chồng** (`inX`, `outX` trong `TreeNode`).
  - Thẻ có vợ/chồng rộng khoảng 108 thay vì 56: rộng hơn kiểu D63 nhưng vẫn hẹp hơn thẻ ngang (176), và thẻ thấp hơn.
- Bản in A1 vẫn dùng kiểu D63.
