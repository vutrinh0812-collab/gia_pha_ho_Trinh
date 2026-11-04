# Gia Phả Dòng Họ

Web app lưu giữ và cập nhật gia phả của một dòng họ, hiển thị dạng cây theo đời. Ưu tiên xem trên điện thoại.

- Đặc tả đầy đủ: [`SPEC.md`](SPEC.md)
- Nhật ký quyết định kỹ thuật: [`DECISIONS.md`](DECISIONS.md)

**Giao diện:** mẫu "Sơn son" (đỏ son truyền thống, font Lexend dễ đọc), xem `DECISIONS.md` D36 và các mẫu đề xuất trong `design/proposals/`.

**Công nghệ:** React 18 + Vite + TypeScript · Zustand · Firebase (Firestore, Auth, Storage, Hosting) · Vitest.

**Trạng thái:** ✅ Giai đoạn 1 (khởi tạo) · ✅ Giai đoạn 2 (dữ liệu & bảo mật) · ✅ Giai đoạn 3a (giao diện điện thoại: Gia đình, Danh sách, tìm kiếm) · ✅ Giai đoạn 3b (Sơ đồ: phóng to nhiều mức, thu gọn nhánh, lọc, dòng dõi) · ✅ Giai đoạn 3c (bố cục máy tính, phím tắt) · ✅ Giai đoạn 3d (cài lên điện thoại, xem khi mất mạng, chia sẻ link) · ✅ Giao diện Sơn son · ✅ Giai đoạn 4 (chế độ Admin: sửa, thêm, xóa, lịch sử, hoàn tác) · ✅ Giai đoạn 5 (4 theme in, đổi giao diện trên sơ đồ, in theo chi). Các giai đoạn tiếp theo: xem SPEC.md §12.

---

## 1. Cần cài gì trên máy

| Phần mềm | Phiên bản | Dùng để |
|---|---|---|
| [Node.js](https://nodejs.org) | 20 trở lên (khuyên dùng 22 LTS) | chạy và build app |
| [Java](https://adoptium.net) | 11 trở lên | chạy Firebase Emulator trên máy (chỉ cần khi phát triển) |
| Git | bất kỳ | tải mã nguồn |

Kiểm tra bằng lệnh:

```bash
node -v
```

```bash
java -version
```

## 2. Chạy thử ngay trên máy (không cần tài khoản Firebase)

Cách này dùng **Firebase Emulator**: một bản Firebase giả chạy trên máy bạn, không ảnh hưởng tới dữ liệu thật.

1. Cài thư viện (chỉ làm lần đầu):

   ```bash
   npm install
   ```

2. Mở **cửa sổ terminal thứ nhất**, bật emulator:

   ```bash
   npm run emulators
   ```

   Đợi đến khi thấy dòng `All emulators ready!`. Bảng điều khiển emulator ở http://127.0.0.1:4000.

3. Mở **cửa sổ terminal thứ hai**, tạo dữ liệu mẫu (khoảng 300 người hư cấu, 7 đời) và tài khoản admin thử:

   ```bash
   npm run seed
   ```

   Mã admin trên emulator là `ma-admin-demo`. Muốn xóa và tạo lại dữ liệu mẫu thì chạy `npm run seed -- --clear`.

   Dữ liệu emulator được lưu vào thư mục `.emulator-data/` khi tắt emulator bằng Ctrl+C, và tự nạp lại lần sau.

4. Vẫn ở terminal thứ hai, chạy app:

   ```bash
   npm run dev:emu
   ```

5. Mở trình duyệt tại http://localhost:5173. Trang chủ phải hiện:
   - ✓ Đã đủ biến môi trường
   - Chế độ: Firebase Emulator
   - ✓ Kết nối thành công — Hệ Phả Họ Trịnh, 297 người, 7 đời

> Xem trên điện thoại cùng mạng Wi-Fi: chạy `npm run dev:emu -- --host`, rồi mở địa chỉ `Network:` mà Vite in ra.
> (Khi đó app trên điện thoại vẫn cố kết nối emulator ở `127.0.0.1`, nên phần kết nối chỉ chạy trên máy tính. Muốn thử dữ liệu trên điện thoại, hãy dùng project Firebase thật ở mục 3.)

## 3. Tạo project Firebase thật (từng bước)

### 3.1 Tạo project
1. Vào https://console.firebase.google.com, đăng nhập bằng tài khoản Google.
2. Bấm **Create a project** (Tạo dự án). Đặt tên, ví dụ `gia-pha-ho-trinh`.
3. Google Analytics: có thể **tắt** (không cần).
4. Bấm **Create project**, đợi xong.

### 3.2 Đăng ký web app và lấy cấu hình
1. Ở trang tổng quan project, bấm biểu tượng **`</>`** (Web).
2. Đặt tên app, ví dụ `gia-pha-web`. Đánh dấu **Also set up Firebase Hosting**.
3. Firebase hiện một đoạn `const firebaseConfig = { apiKey: ..., ... }`. Giữ trang này lại để chép ở bước 3.5.

### 3.3 Bật Firestore
1. Menu trái: **Build → Firestore Database → Create database**.
2. Chọn vị trí gần Việt Nam: `asia-southeast1` (Singapore). **Không đổi được về sau.**
3. Chọn **Start in production mode** (an toàn; rules của dự án sẽ được deploy ở bước 5).

### 3.4 Bật đăng nhập Email/Password
1. Menu trái: **Build → Authentication → Get started**.
2. Tab **Sign-in method** → chọn **Email/Password** → bật **Enable** → **Save**.

Tài khoản admin được tạo ở bước 3.8, sau khi đã có file `.env`.

### 3.5 Tạo file `.env`
1. Sao chép file mẫu:

   ```bash
   cp .env.example .env
   ```

2. Mở `.env` và điền các giá trị từ bước 3.2:

   | Biến | Lấy từ `firebaseConfig` |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

3. Điền thêm:
   - `VITE_CLAN_ID` — mã dòng họ, chữ thường không dấu, ví dụ `ho-trinh`.
   - `VITE_ADMIN_EMAIL` — email admin ở bước 3.4.
   - `VITE_USE_EMULATOR=false`.

> Các giá trị `VITE_FIREBASE_*` **không phải bí mật**: chúng luôn nằm trong mã JavaScript gửi tới trình duyệt. Dữ liệu được bảo vệ bằng **Security Rules**, không phải bằng việc giấu cấu hình. Tuy vậy, file `.env` vẫn không được commit lên Git.

### 3.6 Ảnh đại diện (Cloud Storage) — tùy chọn
Project Firebase mới cần nâng lên gói **Blaze** (trả theo mức dùng, có hạn mức miễn phí, phải gắn thẻ) mới bật được Storage. App vẫn chạy đầy đủ **không cần** Storage, chỉ không tải ảnh lên được. Xem `DECISIONS.md` mục D8.

### 3.7 Lấy khóa service account (cho các script quản trị)
Script tạo tài khoản admin và nạp dữ liệu mẫu cần một "khóa quản trị" của project.
1. Firebase Console → ⚙️ **Project settings** → tab **Service accounts** → **Generate new private key** → **Generate key**.
2. Một file `.json` được tải về. **Đây là khóa toàn quyền**:
   - lưu **ngoài** thư mục dự án, ví dụ `~/firebase-keys/gia-pha.json`;
   - không gửi cho ai và không đưa lên Git.
3. Mỗi lần chạy script, khai báo đường dẫn tới file khóa:

   macOS/Linux:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=~/firebase-keys/gia-pha.json
   ```

   Windows (PowerShell):

   ```bash
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\firebase-keys\gia-pha.json"
   ```

### 3.8 Mật khẩu admin
Không cần tạo tài khoản. Chế độ Admin là **khóa bằng mật khẩu ngay trên trang web**. Mật khẩu mặc định là `7150565`. Hãy đổi ngay sau khi vào lần đầu, ở **Quản trị → Đổi mật khẩu** (xem mục 4).

Cần đưa luật bảo mật lên Firebase một lần (và mỗi khi `firestore.rules` hoặc `storage.rules` thay đổi):

```bash
npx firebase deploy --only firestore:rules,storage
```

Không dùng được dòng lệnh thì mở Firebase Console → **Firestore Database → Rules**, dán toàn bộ nội dung file `firestore.rules` rồi bấm **Publish**. Làm tương tự với **Storage → Rules** và file `storage.rules`.

### 3.9 Nạp dữ liệu mẫu lên project thật (tùy chọn)
Chỉ nên làm để thử nghiệm. Trước khi nhập dữ liệu thật, hãy xóa dữ liệu mẫu bằng `--clear`.

```bash
npm run seed -- --real
```

### 3.10 Chạy app với project thật

```bash
npm run dev
```

Mở http://localhost:5173. Trang chủ phải báo **Chế độ: Firebase thật** và **✓ Kết nối thành công**.

## 4. Đổi mật khẩu admin

Vào **Quản trị** (`/admin`) → phần **Đổi mật khẩu**: nhập mật khẩu hiện tại, mật khẩu mới (ít nhất 4 ký tự) hai lần, rồi bấm **Đổi mật khẩu**. Mật khẩu được lưu dạng mã hóa (SHA-256 có salt) trong Firestore, tại `clans/{clanId}/config/lock`.

**Quên mật khẩu:** vào Firebase Console → Firestore → `clans/{clanId}/config` → xóa document `lock`. Mật khẩu trở về mặc định `7150565`.

## 5. Đưa lên mạng (deploy)

1. Cài Firebase CLI có sẵn trong dự án, đăng nhập:

   ```bash
   npx firebase login
   ```

2. Chọn project thật (thay `gia-pha-ho-trinh` bằng project id của bạn):

   ```bash
   npx firebase use --add gia-pha-ho-trinh
   ```

3. Build và deploy app + rules (rules bảo mật được deploy cùng lệnh này):

   ```bash
   npm run build && npx firebase deploy --only hosting,firestore
   ```

   Nếu đã bật Storage, deploy thêm rules ảnh:

   ```bash
   npx firebase deploy --only storage
   ```

4. Địa chỉ web sẽ là `https://<project-id>.web.app`.

## 6. Các lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | chạy app với project Firebase thật (đọc `.env`) |
| `npm run dev:emu` | chạy app với emulator (đọc `.env.emulator`) |
| `npm run emulators` | bật Firebase Emulator (Firestore, Auth, Storage, Hosting) |
| `npm run build:preview` | đóng gói bản xem thử (dữ liệu mẫu, không cần Firebase) thành 1 file HTML: `dist-preview/gia-pha-xem-thu.html` |
| `npm run dev:demo` | chạy app với dữ liệu mẫu, không cần Firebase |
| `npm run seed` | nạp dữ liệu mẫu hư cấu vào emulator (`--clear` để làm lại, `--real` cho project thật) |
| `npm run admin:setup` | (không còn cần) tài khoản Firebase cho cách admin cũ |
| `npm test` | chạy unit test (âm lịch, tính đời, dữ liệu mẫu, kiểm tra dữ liệu) |
| `npm run test:rules` | chạy test bảo mật Firestore/Storage trên emulator (cần Java) |
| `npm run test:all` | chạy cả hai loại test |
| `npm run test:e2e` | test trên điện thoại giả lập (iPhone SE, iPhone 14, Pixel 5, Galaxy A 360px, Zalo, Facebook) |
| `npm run build` | kiểm tra kiểu + build bản production vào `dist/` |
| `npm run preview` | xem thử bản build |

## 7. Cấu trúc thư mục

```
src/
  app/            # router, layout, trang chủ
  features/       # tree, person, admin, print, anniversaries
  themes/         # design system theo theme (giai đoạn 5)
  lib/
    types.ts        # mô hình dữ liệu
    generation.ts   # chỉ mục quan hệ, tính đời, dòng dõi, đếm con cháu
    lunar.ts        # âm lịch Việt Nam, can chi, ngày giỗ
    validators.ts   # kiểm tra dữ liệu phía client (khớp với firestore.rules)
    sampleData.ts   # sinh dữ liệu mẫu hư cấu
    env.ts, firebase.ts
  store/          # zustand
tests/            # unit test
  rules/          # test bảo mật (emulator)
scripts/          # seed.ts, setup-admin.ts
firestore.rules   # công khai đọc; chỉ admin ghi; kiểm tra kiểu dữ liệu
storage.rules     # ảnh: công khai đọc; chỉ admin tải lên; ảnh < 2MB
```

## 8. Bảo mật — tóm tắt

- Ai có link đều **xem** được cây gia phả.
- Chế độ Admin chỉ là **khóa bằng mật khẩu trên trang web** (lựa chọn của dòng họ cho đơn giản). Không có đăng nhập phía máy chủ, nên `firestore.rules` cho **bất kỳ ai** ghi dữ liệu đúng định dạng. Người rành kỹ thuật có thể bỏ qua ô mật khẩu (dùng công cụ lập trình của trình duyệt) để sửa hoặc xóa dữ liệu. Mật khẩu ngắn toàn chữ số cũng dò ra được nhanh.
- Vì vậy hãy **sao lưu thường xuyên** (Firebase Console → Firestore → Import/Export, hoặc bật Point-in-time recovery), và dùng **Lịch sử thay đổi** để xem, hoàn tác.
- Mọi dữ liệu ghi vào vẫn được kiểm tra kiểu và độ dài ngay trong `firestore.rules`. Lịch sử thay đổi (`auditLog`) không ai sửa hay xóa được qua web.
- Muốn quay lại bảo vệ thật phía máy chủ: chỉ cần sửa hàm `isAdmin` trong `firestore.rules` và `storage.rules`.
- `npm run test:rules` kiểm tra các luật trên.

## 9. Chia sẻ link, cài lên điện thoại, xem khi mất mạng

- **Ảnh xem trước khi gửi link qua Zalo/Messenger/Facebook:**
  - Cần điền `VITE_SITE_URL` (địa chỉ web thật, ví dụ `https://gia-pha-ho-trinh.web.app`) và `VITE_APP_TITLE` trong `.env`, rồi build lại.
  - Muốn đổi tên dòng họ trên ảnh xem trước: sửa `VITE_APP_TITLE` rồi chạy `node scripts/make-icons.mjs`.
  - Zalo/Facebook lưu ảnh xem trước một thời gian. Khi đổi ảnh, dùng [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) để làm mới.
- **Cài lên màn hình chính:**
  - Android/Chrome: menu "Thêm" có nút cài.
  - iPhone/Safari: bấm Chia sẻ, chọn "Thêm vào MH chính".
  - Trong Zalo/Facebook: phải chọn "Mở bằng trình duyệt" trước.
- **Mất mạng:** những gì đã xem vẫn mở được; trang báo "Đang mất mạng".

### Kiểm tra bằng tay trên điện thoại thật (sau khi đưa web lên mạng)
Test tự động dùng trình duyệt giả lập. Những việc sau cần làm bằng tay một lần trên máy thật:

1. Gửi link trang chủ và link một người qua **Zalo**: xem ảnh xem trước, bấm mở, tìm một người, bấm Chia sẻ.
2. Làm như trên với **Messenger/Facebook**.
3. Mở bằng **Safari trên iPhone**: thêm vào màn hình chính, mở lại, bật chế độ máy bay, mở lại lần nữa.
4. Mở bằng **Chrome trên Android**: cài ứng dụng, xoay ngang khi xem Sơ đồ.

## 10. Chế độ Admin (sửa gia phả)

1. Mở **Thêm → Chế độ Admin** (hoặc vào `/admin`), nhập **mật khẩu** (mặc định `7150565`).
2. Thanh **"Đang ở chế độ Admin · Thoát"** hiện ra. Phiên tự thoát sau 30 phút không thao tác, hoặc khi đóng trình duyệt.
3. Sửa một người theo một trong các cách:
   - **nhấn giữ** vào tên người đó (trên điện thoại);
   - mở **Xem chi tiết** rồi bấm **Sửa thông tin** hoặc **Thao tác khác…**;
   - bấm **Thao tác (Admin)** trên thẻ người đang xem.
4. **Thao tác** gồm: thêm con, thêm vợ/chồng, thêm cha cho thủy tổ, đổi thứ tự anh chị em, xóa. **Người còn con không xóa được**; hãy xóa hoặc chuyển các con trước.
5. **Quản trị → Lịch sử thay đổi**: xem mọi thay đổi, lọc theo tên hoặc ngày, và **hoàn tác** từng thao tác.
6. **Quản trị → Cài đặt dòng họ**: tên, tiêu đề, câu đối, lạc khoản, hiện hay ẩn con cháu bên ngoại.

Trong bản xem thử (không có Firebase), mật khẩu là `ma-admin-demo`. Mọi thay đổi chỉ nằm trong trang đó và mất khi tải lại.

## 11. Giao diện in và in theo chi

- **Thêm → Giao diện in (theme)** (`/themes`): xem cùng một bản in A1 với các theme, bấm **Xem lớn** để xem chi tiết.
- **In gia phả** (`/print`): chọn theme, khổ ngang/dọc, ẩn hoặc hiện vợ chồng, năm sinh mất, câu đối…
- **In theo chi:** ở ô **Phạm vi in**, chọn một người. Bản in sẽ gồm:
  - mọi người từ thủy tổ xuống tới người đó;
  - toàn bộ con cháu của người đó;
  - anh chị em và các nhánh khác vẫn hiện, nhưng con cháu của họ được thu gọn, ghi "+N con cháu".
- Cách nhanh hơn: mở chi tiết một người có con, rồi bấm **In gia phả theo chi của …**.
- **Đổi giao diện sơ đồ:** trong màn Sơ đồ, bấm nút **Giao diện** (biểu tượng bảng màu). Chọn Sơn son, Truyền thống đỏ, Sơn mài vàng, Giấy dó mực tàu hoặc Men lam. Máy sẽ nhớ lựa chọn này, và trang In cũng dùng sẵn giao diện đó.
- Admin chọn giao diện in mặc định cho cả dòng họ ở **Quản trị → Cài đặt dòng họ**.
- Xuất file PDF/SVG/PNG để mang đi in: giai đoạn 6.

## 12. Nạp gia phả họ Trịnh (từ sổ gia phả)

Dữ liệu từ sổ nằm trong `private-data/ho-trinh.json` (9 gia đình, 57 người). Thư mục `private-data/` **không đưa lên Git** (repo công khai): giữ file này trên máy quản trị, còn người xem đọc từ Firebase. Đời III trong sổ là **Đời 1** trong app. File gồm `sach` (nội dung sổ), `gioi_tinh` (sổ không ghi giới tính), `suy_doan` (tên cần xác nhận) và `cai_dat`; xem mẫu ở `tests/fixtures/book-sample.json`.

1. Làm theo mục 3 để có project, Firestore, tài khoản admin và khóa service account (bước 3.7).
2. Nạp thử trên emulator (không ảnh hưởng dữ liệu thật):

   ```bash
   npm run emulators
   ```

   ```bash
   npm run import:ho-trinh
   ```

3. Nạp lên project thật. Thêm `--clear` nếu dòng họ đang có dữ liệu mẫu cần xóa:

   ```bash
   npm run import:ho-trinh -- --real
   ```

4. Xem thử không cần Firebase, với dữ liệu trong `private-data/`:

   ```bash
   VITE_DEMO_DATASET=ho-trinh npm run dev:demo
   ```

**Mở rộng đời:** thêm con để mở đời xuống dưới (đời 4 đang trống). Muốn thêm tổ tiên ở trên, mở một người ở đời 1 và chọn **Thêm cha chung**; mọi người sẽ lùi một đời.

## 13. Đưa lên Vercel

Web chỉ là các file tĩnh; dữ liệu đọc thẳng từ Firebase, nên Vercel không giữ dữ liệu gia phả nào.

1. Vào https://vercel.com → **Add New → Project** → chọn repo này. Vercel tự nhận Vite nhờ file `vercel.json`.
2. Mở **Settings → Environment Variables**, thêm các biến sau (chọn cả Production và Preview):

   | Biến | Giá trị |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` của web app |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |
   | `VITE_CLAN_ID` | `ho-trinh` |
   | `VITE_SITE_URL` | địa chỉ web sau khi có (để chia sẻ link có ảnh xem trước) |

3. Bấm **Deploy**.
4. Điền lại `VITE_SITE_URL` bằng địa chỉ thật rồi **Redeploy**.

Dữ liệu thật **không** nằm trong repo: nó ở Firebase (nạp bằng `npm run import:ho-trinh`, mục 12).
