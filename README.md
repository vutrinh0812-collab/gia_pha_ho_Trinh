# Gia Phả Dòng Họ

Web app lưu giữ và cập nhật gia phả của một dòng họ, hiển thị dạng cây theo đời. Ưu tiên xem trên điện thoại.

- Đặc tả đầy đủ: [`SPEC.md`](SPEC.md)
- Nhật ký quyết định kỹ thuật: [`DECISIONS.md`](DECISIONS.md)

**Công nghệ:** React 18 + Vite + TypeScript · Zustand · Firebase (Firestore, Auth, Storage, Hosting) · Vitest.

**Trạng thái:** ✅ Giai đoạn 1 (khởi tạo). Các giai đoạn tiếp theo: xem SPEC.md §12.

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

3. Mở **cửa sổ terminal thứ hai**, chạy app:

   ```bash
   npm run dev:emu
   ```

4. Mở trình duyệt tại http://localhost:5173. Trang chủ phải hiện:
   - ✓ Đã đủ biến môi trường
   - Chế độ: Firebase Emulator
   - ✓ Kết nối thành công

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

### 3.4 Bật đăng nhập và tạo tài khoản admin
1. Menu trái: **Build → Authentication → Get started**.
2. Tab **Sign-in method** → chọn **Email/Password** → bật **Enable** → **Save**.
3. Tab **Users** → **Add user**:
   - Email: một email **thật bạn quản lý**, ví dụ `giapha.hotrinh@gmail.com`.
   - Password: đây chính là **mã admin**. Nên dài ít nhất 12 ký tự.
4. Không chia sẻ email này công khai. Người dùng chỉ cần biết **mã admin**.

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

### 3.7 Chạy app với project thật

```bash
npm run dev
```

Mở http://localhost:5173. Trang chủ phải báo **Chế độ: Firebase thật** và **✓ Kết nối thành công**.

## 4. Đổi mã admin

Mã admin = mật khẩu của tài khoản admin. Có hai cách:

- **Cách 1 (khuyên dùng):** Firebase Console → **Authentication → Users** → dòng tài khoản admin → menu **⋮** → **Reset password**. Firebase gửi email đặt lại mật khẩu tới email admin; mở email và đặt mã mới.
- **Cách 2:** Xóa tài khoản admin rồi **Add user** lại với cùng email và mật khẩu mới. Rules phân quyền theo email nên vẫn hoạt động.

Người đang đăng nhập bằng mã cũ sẽ phải nhập lại mã mới ở lần đăng nhập sau.

## 5. Đưa lên mạng (deploy)

1. Cài Firebase CLI có sẵn trong dự án, đăng nhập:

   ```bash
   npx firebase login
   ```

2. Chọn project thật (thay `gia-pha-ho-trinh` bằng project id của bạn):

   ```bash
   npx firebase use --add gia-pha-ho-trinh
   ```

3. Build và deploy app + rules:

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
| `npm test` | chạy unit test |
| `npm run build` | kiểm tra kiểu + build bản production vào `dist/` |
| `npm run preview` | xem thử bản build |

## 7. Cấu trúc thư mục

```
src/
  app/            # router, layout, trang chủ
  features/       # tree, person, admin, print, anniversaries
  themes/         # design system theo theme (giai đoạn 5)
  lib/            # env.ts, firebase.ts, (lunar.ts, generation.ts… ở giai đoạn 2)
  store/          # zustand
tests/            # unit test (+ rules test ở giai đoạn 2)
scripts/          # seed dữ liệu mẫu (giai đoạn 2)
firestore.rules   # hiện chỉ cho đọc, cấm ghi — rules admin đầy đủ ở giai đoạn 2
storage.rules
```
