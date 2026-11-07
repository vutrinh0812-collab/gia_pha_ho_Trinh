---
name: thiet-ke-khung-gia-pha
description: Thiết kế một preset khung tranh gia phả khổ A1 trên Canva (ảnh nền, bảng tiêu đề tách lớp, câu đối, bảng màu, kiểu chữ, bố cục chữ tiêu đề theo độ cong của bảng) cùng người dùng, dừng lại hỏi ở từng quyết định và đưa ít nhất 3 phương án ở các quyết định lớn, rồi đóng gói thành giao diện in của ứng dụng gia phả (theme có sẵn hoặc gói JSON tự nhập) và xuất PDF kiểm tra. Dùng khi người dùng gọi /thiet-ke-khung-gia-pha, hoặc nhờ "thiết kế khung gia phả", "làm preset giao diện in", "khung tranh gia phả mới trên Canva", "thêm giao diện in".
---

# Thiết kế khung tranh gia phả trên Canva

Quy trình này được đúc kết từ lần làm preset "Sơn mài rồng vàng" (DECISIONS D72–D77) và
"Đỏ son sen vàng" (D78–D79). Kết quả
cuối cùng là một giao diện in A1 trong ứng dụng: chọn được ở **Cài đặt → In ấn**, xuất được PDF
A1 sắc nét, tiếng Việt đúng dấu.

## Nguyên tắc làm việc với người dùng

- **Trả lời bằng tiếng Việt**, xưng hô như trong cuộc trò chuyện (thường là "bác/tôi").
- **Người dùng quyết, mình đề xuất.** Không tự chốt bố cục, câu chữ, màu sắc, kiểu chữ hay
  họa tiết. Ở mỗi bước dưới đây có ghi rõ chỗ phải **DỪNG**.
- **Quyết định lớn: ít nhất 3 phương án, có hình.** Ghép các phương án thành một tấm so sánh có
  nhãn A, B, C (`scripts/bang-so-sanh.py`), gửi bằng `SendUserFile` (display `render`), rồi hỏi bằng
  `AskUserQuestion`: mỗi phương án là một lựa chọn, phương án mình khuyên đặt đầu, thêm
  "(Khuyên dùng)" và một câu lý do. Người dùng luôn có thể chọn "Khác" để tả ý mình.
- **Quyết định nhỏ** (một câu chữ, một khoảng cách, bật/tắt một chi tiết): hỏi gọn bằng
  `AskUserQuestion`, có thể gộp tối đa 4 câu hỏi một lần. Không cần 3 mẫu.
- Sau mỗi lần sửa trên Canva: xem lại thumbnail, gửi ảnh cho người dùng duyệt trước khi đi tiếp.
- Đã duyệt thì ghi lại ngắn gọn (một dòng) những gì đã chốt, để cuối cùng đưa vào DECISIONS.md.

## Chuẩn bị (làm trước, không cần hỏi)

1. Nạp công cụ Canva: `ToolSearch` với `+Canva` (cần `create-design`, `generate-design`,
   `create-design-from-candidate`, `read-design`, `edit-design`, `export-design`,
   `resize-design`, `generate-image`, `copy-design`, `get-export-formats`). Nếu không có công cụ
   Canva nào: nói người dùng cần kết nối Canva (dùng `read_documentation` chủ đề `connectors.add`)
   rồi dừng.
2. Thử tải về một file từ `export-download.canva.com`. Nếu bị proxy chặn (403), xin thêm đúng host
   này vào môi trường bằng `get_environment` rồi `update_environment` (lần trước đã làm như vậy).
3. Đọc nhanh: `src/themes/types.ts` (Theme, TitleBoard, coupletBoxes), `src/themes/son-mai-rong-vang/theme.ts`
   (mẫu đầy đủ nhất), `src/features/print/packs.ts` (định dạng gói JSON), `src/features/print/exportPdf.ts`
   (`PDF_FONTS`). Mục DECISIONS mới nhất để biết số D tiếp theo.
4. Tạo thư mục làm việc trong scratchpad, ví dụ `<scratchpad>/khung-<ten>/`.

## Bước 1 — Hiểu yêu cầu và chốt hướng phong cách  ▶ DỪNG, 3+ phương án

Từ gợi ý phong cách của người dùng (ví dụ "nền tối, chữ và khung mạ vàng"), đề xuất **3 hướng
phong cách** khác nhau thật sự, mỗi hướng gồm: tên ngắn, chất liệu nền, tông màu chủ đạo, họa tiết
chính (rồng, mây, trống đồng, hoa sen, mai, tre…), tinh thần chữ.

- Làm hình cho mỗi hướng: `generate-design` (lấy các mẫu ứng viên) hoặc `generate-image` khổ
  ngang. Tải thumbnail/ảnh về, ghép bằng `bang-so-sanh.py`, gửi người dùng.
- Hỏi cùng lúc (nếu người dùng chưa nói): hướng giấy (ngang hay dọc; mặc định A1 ngang
  841 × 594 mm), có câu đối hai bên không, có con triện không.

## Bước 2 — Bố cục  ▶ DỪNG, 3+ phương án

Đề xuất **3 bố cục** trên tờ A1, vẽ phác bằng ô chữ nhật đơn giản (có thể dùng SVG/HTML chụp bằng
Playwright, hoặc trang Canva nháp). Mỗi bố cục ghi rõ:

- Vị trí và kiểu **bảng tiêu đề** (cuốn thư, hoành phi, băng lụa, bảng gỗ…), đặt giữa phía trên
  hay lệch.
- Vị trí **câu đối** (hai bảng dọc sát mép trái/phải, hay không có).
- **Vùng cây gia phả** (vùng trống ở giữa, càng rộng càng tốt; cây rất rộng ngang). Ghi lề vùng này
  theo mm, sau này thành `contentInsetMm`.
- Họa tiết góc/viền, họa tiết chìm ở giữa (phải mờ để không tranh với cây).

Lưu ý: vùng cây là phần quan trọng nhất của bản in; đừng để họa tiết chiếm chỗ của nó.

## Bước 3 — Các thành phần (item)  ▶ DỪNG cho từng nhóm, 3+ phương án

Với mỗi thành phần lớn đã chọn ở bước 2, đưa **3 mẫu** để chọn:

- **Bảng tiêu đề**: hình dáng, viền, trang trí hai đầu. Bảng phải có **lòng trống, tối hoặc sáng
  đều**, đủ rộng để viết chữ, vì chữ do ứng dụng viết (người dùng gõ ở trang In ấn).
- **Bảng câu đối** (nếu có): hình dáng, mũ/đế, nền lòng bảng. Lòng bảng cũng để trống: câu đối do
  ứng dụng viết (theo cài đặt dòng họ, hoặc câu mặc định của preset).
- **Họa tiết góc/viền** và **họa tiết chìm ở giữa** (độ đậm; có thể chỉnh sau bằng
  `lam-ro-lop.py`).

Dùng `generate-image` cho từng thành phần hoặc thử trực tiếp trên bản thiết kế, rồi ghép so sánh.

## Bước 4 — Bảng màu (design token)  ▶ DỪNG, 3 phương án

Đề xuất **3 bảng màu** tone-sur-tone với nền, mỗi bảng đủ các token mà theme cần:

| Token | Dùng cho |
|---|---|
| `background`, `surface` | nền tờ, nền ô người |
| `frame`, `frameInner` | viền ô người, đường kẻ |
| `line` | đường nối các đời |
| `textPrimary`, `textSecondary` | tên người, năm sinh–mất |
| `male`, `female`, `spouse`, `deceased` | màu tên theo giới, dâu rể, người đã mất |
| `accent`, `bannerText`, `coupletText` | điểm nhấn, chữ tiêu đề, chữ câu đối |

Kiểm tra độ tương phản chữ trên `surface` (chữ nhỏ phải đọc được khi in). Minh họa bằng
`scripts/mau-chu.cjs` (đổi `nen/chu/phu` theo từng bảng màu) và ghép lại.

## Bước 5 — Kiểu chữ  ▶ DỪNG, 3 phương án

Đề xuất **3 bộ phông** (tiêu đề / tên người / câu đối). Bắt buộc:

- Chỉ dùng phông **Google Fonts có đủ dấu tiếng Việt** (kiểm tra bằng `phong-pdf.sh`, dòng cuối báo
  "đủ chữ tiếng Việt").
- Tên người và năm sinh phải **dễ đọc ở cỡ nhỏ** (serif nghiêng mềm như Lora vẫn ổn; phông thư
  pháp chỉ dùng cho tiêu đề, dòng phụ, câu đối).
- Phông bút lông (Water Brush…) có khoảng trắng hẹp và chữ hoa vung nét (chữ T phủ lên chữ sau);
  ứng dụng đã tự bù khi đặt chữ theo cung (D75), nhưng vẫn nên khuyên người dùng viết hoa chữ đầu
  thay vì viết hoa toàn bộ.

Render bằng `node scripts/mau-chu.cjs spec.json out.png` (xem chú thích đầu file), gửi người dùng.
Nếu ảnh bảng tiêu đề đã có (bước 3), dựng phông tiêu đề **ngay trên ảnh bảng thật** bằng
`node scripts/mau-tieu-de.cjs` (chữ để thẳng, độ cong chọn ở bước 6). Nền bảng sáng (vàng óng)
thì chữ tiêu đề phải tối (`bannerText`, ví dụ nâu đồng #4a2a0c), hỏi người dùng màu chữ.

## Bước 6 — Bố cục chữ tiêu đề trên bảng  ▶ DỪNG, 3 phương án

Tiêu đề là chỗ người xem nhìn đầu tiên: chữ phải **nằm gọn trong mặt bảng, cách đều mép trên và
mép dưới, ôm theo hình bảng** (cuốn thư vồng lên, băng lụa võng xuống giữa hai cuộn, hoành phi
thẳng) và **hợp tinh thần khung** (khung trang nghiêm thì chữ khắc đậm, chữ hoa giãn; khung mềm
thì thư pháp). Làm khi ảnh bảng đã cố định (bước 3) và phông đã chọn (bước 5).

1. **Đo vùng chữ** (`textBox`, tỉ lệ 0–1 của ảnh bảng đã cắt sát): kẻ lưới 10% lên ảnh bảng
   (nền đỏ phía sau) rồi lấy **mặt phẳng thật sự để viết**: bên trong đầu cuộn, dưới tòa
   sen/trang trí, trên mép viền dưới. Không cần chừa lề: ứng dụng tự chừa 7% trên dưới, 4% hai bên.
2. **Đo độ cong**: dò mép của mặt chữ (mép dưới với băng võng, mép trên với cuốn thư vồng) ở vài
   cột trong `textBox` (cột kênh alpha hoặc nơi độ sáng đổi nhiều nhất). Với độ lệch `s` giữa giữa
   bảng và hai đầu, ở nửa dây cung `c` (cả hai tính theo bề rộng bảng): bán kính = c² ÷ (2s).
   **Dấu**: dương = vồng (giữa cao hơn, ví dụ cuốn thư rồng vàng 1,96); âm = võng (giữa thấp hơn,
   ví dụ băng lụa sen vàng −2,0).
3. **Dựng ≥ 3 phương án trên ảnh bảng thật** bằng
   `node scripts/mau-tieu-de.cjs spec.json out.png`. Script dùng **đúng cách đặt chữ của ứng dụng**
   (`fitBoardText`, D79): đo phần mực thật của chữ, kể cả dấu thanh trên chữ hoa (Ả, Ỗ, Ấ) và độ
   nhô của cung, rồi căn cả khối vào giữa; khung xanh đứt nét là `textBox`. Các trục để phối:
   thẳng / theo cung đo được; chữ thường / chữ hoa giãn chữ (0,04–0,08 em). Ví dụ ba phương án:
   võng + chữ thường, thẳng + chữ hoa, võng + chữ hoa.
4. **Thử chữ khó trước khi chốt** (cùng script, trường `tieuDe_text` / `dongPhu_text`): tiêu đề
   ngắn có dòng phụ; tiêu đề dài nhiều dấu chồng (ví dụ "Dòng Họ Nguyễn Hữu – Chi Trưởng Ấp Đông");
   không có dòng phụ. Mọi chữ phải nằm trong khung xanh. Tiêu đề quá dài sẽ co rất nhỏ: cho người
   dùng xem trường hợp này và khuyên giữ tiêu đề khoảng 20 ký tự, phần còn lại đưa xuống dòng phụ.
5. Ghi vào theme: `titleBoard.textBox`, `titleBoard.arcRadius` (có dấu; bỏ trống = thẳng),
   `typography.title.uppercase` (ứng dụng tự viết hoa, người dùng vẫn gõ bình thường),
   `typography.title.letterSpacing` (được tính khi co chữ cho vừa bảng).
6. **Bắt buộc soát trên PDF thật** (bước 11): phóng vùng bảng ở 300 dpi
   (`pdftoppm -r 300 -x … -y …`; mm × 11,81 = px). Phải thấy: dấu cao nhất không chạm mép trên mặt
   bảng; khoảng trống trên và dưới khối chữ gần bằng nhau; hai đầu dòng không lấn vào đầu cuộn;
   tiêu đề và dòng phụ không dính nhau. Sai thì sửa `textBox` (đừng sửa cỡ chữ bằng tay), dựng lại.

## Bước 7 — Câu chữ  ▶ DỪNG

- **Câu đối mặc định của preset**: đưa **3 cặp câu đối** hợp phong cách (ví dụ "Cây có cội mới
  nảy cành xanh ngọn / Nước có nguồn mới bể rộng sông sâu"; "Tổ đức muôn đời soi lối cháu / Gia
  phong một nếp giữ tình con"…), mỗi vế cùng số chữ, đối ý. Câu của cài đặt dòng họ luôn được ưu
  tiên; câu mặc định chỉ dùng khi dòng họ để trống.
- Tên preset (hiện ở trang In ấn) và một câu mô tả ngắn: đề xuất 3 tên.

## Bước 8 — Dựng trên Canva và duyệt bản hoàn chỉnh  ▶ DỪNG (duyệt)

1. Tạo bản thiết kế theo các lựa chọn đã chốt (`create-design` với brief chi tiết bằng tiếng Việt
   hoặc `create-design-from-candidate` từ mẫu đã chọn). Có thể xin thêm trang 2 là bảng token để
   lưu lại.
2. **Kiểm tra chính tả tiếng Việt** trong mọi chữ Canva tự sinh (lần trước có "Cày", "báy",
   "VIỄN"): `read-design` để đọc chữ, sửa bằng `edit-design` (`find_and_replace_text`).
3. Gửi thumbnail cho người dùng duyệt; sửa đến khi người dùng đồng ý.

## Bước 9 — Xuất ảnh khổ in (giới hạn Canva gói miễn phí)

Những gì đã gặp và cách xử lý:

- `export-design` **chỉ xuất đúng cỡ gốc** của thiết kế; truyền `width` hay `export_quality: pro`
  sẽ báo "Not allowed to access design". Bản sao tạo bằng `copy-design` qua API cũng **không xuất
  được**. Vì vậy: phóng chính thiết kế lên cỡ lớn bằng `resize-design` (tạo một bản mới xuất được),
  rồi xuất ở cỡ gốc.
- Diện tích tối đa của một thiết kế: **5600 × 3955 px** cho A1 ngang (≈169 dpi) xuất được;
  6358 × 4490 bị từ chối. Số lần `resize-design` dùng thử có hạn: phóng **một lần**, sau đó chỉ
  sửa trên bản lớn.
- Bố cục sau khi resize có thể xô lệch: `read-design` lấy id các phần tử, chỉnh bằng
  `position_element`/`resize_element`, kéo ảnh nền phủ kín trang (`crop_media`).
- **Không xuất được PNG nền trong suốt.** Để tách bảng tiêu đề thành lớp riêng: xuất hai lần cùng
  cỡ, (A) có bảng và (B) xóa/ẩn bảng, rồi
  `python3 -I scripts/cat-bang-tieu-de.py A.png B.png out.png <trái> <trên> <rộng> <cao>`
  (hộp bao bảng tính bằng px trong ảnh xuất). Script giữ đặc phần lõi bảng và cắt sát.
- **Tách lớp nền**: xóa chữ tiêu đề, chữ câu đối, các ô người mẫu khỏi thiết kế (ứng dụng sẽ vẽ
  những thứ này), xóa bảng tiêu đề (đã thành lớp riêng), rồi xuất ảnh khung.
- **Chỉnh độ đậm một lớp** (ví dụ họa tiết trống đồng rõ hơn 20%): đặt opacity lớp đó về 0, xuất,
  trả opacity về 1, xuất; rồi `python3 -I scripts/lam-ro-lop.py co.png khong.png out.jpg 0.2`.
- Vết thừa nhỏ trong ảnh xuất: vá bằng PIL (chép một mảng nền bên cạnh đè lên), xem lại trước/sau.
- Lưu ảnh khung dạng **JPEG chất lượng 90** (khoảng 1,5 MB); bảng tiêu đề **PNG** trong suốt.

Quy đổi tọa độ: mm trên tờ = px × (841 / bề rộng ảnh px) với A1 ngang (594 / bề cao cho chiều
dọc). Đo vị trí bảng tiêu đề (`topMm`, `widthMm`), vùng chữ trong bảng (tỉ lệ 0–1), lòng hai bảng
câu đối (`coupletBoxes`, mm) và vùng cây (`contentInsetMm`) từ tọa độ phần tử trong `read-design`.
Nếu bảng tiêu đề cong: ước bán kính cung chữ = bán kính lòng bảng ÷ bề rộng bảng (`arcRadius`;
cuốn thư rồng vàng là 1,96).

## Bước 10 — Đóng gói vào ứng dụng  ▶ DỪNG: hỏi kiểu đóng gói

Hỏi người dùng (khuyên phương án 1 nếu preset dành cho mọi người dùng ứng dụng):

1. **Giao diện in có sẵn** trong mã nguồn (như "Sơn mài rồng vàng"):
   - Thư mục `src/themes/<id>/` gồm `khung-a1.jpg`, `bang-tieu-de.png`, `theme.ts`. Registry tự
     nhận thư mục mới. Lấy `son-mai-rong-vang/theme.ts` làm khuôn: `backgroundImage` (stretch),
     `titleBoard`, `coupletBoxes` (kèm `defaultText`), `ornaments.showCouplets`, `contentInsetMm`,
     `preferredOrientation`, `frame.enabled: false`, `fontsCss`, `typography`, `colors`.
     Bảng có phần trang trí rủ xuống hai bên (đuôi lụa…): đặt `titleBoard.treeFrom` (tỉ lệ chiều
     cao bảng mà cây bắt đầu từ đó; mặc định là dưới toàn bộ ảnh), rồi xuất PDF xem các ô đời 2
     ngoài cùng có chạm đuôi không (D78).
   - Phông mới cho PDF: `bash scripts/phong-pdf.sh "<Family>" <weight> <0|1> <khoa>` (chạy ở gốc
     repo) cho từng mặt chữ dùng tới; thêm vào `PDF_FONTS` trong `exportPdf.ts`; thêm dòng giấy
     phép vào `public/fonts/pdf/README.md` (chỉ dùng phông OFL/Apache).
   - Kiểm thử: `tests/printPdf.test.tsx` (số giao diện, phông có trong `PDF_FONTS`, chữ tiêu đề
     nằm trong bảng, câu đối nằm trong `coupletBoxes`), và số giao diện ở `tests/app.test.tsx`.
2. **Gói tự nhập** (không sửa mã): viết file JSON theo `PackJson` trong `packs.ts` (`ten`, `nen`,
   `hinhNen.tep`, `huongGiay`, `vungNoiDungMm`, `mau`, `chu`, `fontsCss`, `bangTieuDe` với `tep`,
   `trenMm`, `rongMm`, `vungChu`, `doCong`). Người dùng chọn cùng lúc JSON + ảnh khung + ảnh bảng
   tiêu đề ở trang In ấn ("Nhập gói giao diện"). Phông lạ không có trong `PDF_FONTS` sẽ bị thay
   bằng Noto Serif khi xuất PDF: nói rõ điều này.

## Bước 11 — Kiểm tra và bàn giao

1. `npx tsc -b --noEmit` và `npx vitest run`. **Không chạy `npx prettier`** (repo không có cấu hình,
   nó đổi cả file sang nháy kép).
2. Chạy bản demo `npx vite --mode demo --port 5199` (MemoryRouter: vào bằng cách bấm Cài đặt →
   In ấn), chọn giao diện mới, gõ tiêu đề, bấm "Tải PDF khổ A1" bằng Playwright; xem PDF bằng
   `pdftoppm` (toàn tờ ở 40 dpi, phóng các vùng: tiêu đề ở 300 dpi, câu đối, vài ô người). Kiểm
   tra: chữ tiếng Việt đủ dấu, tiêu đề đạt đủ các điều ở bước 6 mục 6, không đè họa tiết, cây
   nằm gọn trong vùng. Nếu đổi cách đặt chữ trong `PosterSvg`, xuất lại cả các giao diện có bảng
   tiêu đề khác (ví dụ "Sơn mài rồng vàng") và so trước/sau.
3. Gửi ảnh toàn tờ, ảnh phóng to và file PDF cho người dùng. ▶ DỪNG: hỏi chỉnh gì thêm.
4. Ghi một mục DECISIONS.md mới (số D tiếp theo): preset, các lựa chọn đã chốt, kích thước ảnh,
   token, phông, các hạn chế còn lại.
5. Commit lên nhánh đang làm (kèm dòng ghi công theo hướng dẫn hệ thống), push. Nếu có bản xem thử
   một file: `npm run build:preview` rồi đăng lại artifact cũ (cùng `url`).
6. **Chỉ merge vào main khi người dùng bảo** ("merge main").

## Ghi chú

- **Ảnh Canva tạo chỉ rộng 1536 px**: kéo cả khung lên A1 thì mờ (~46 dpi). Cách đã làm ở D78: tạo
  riêng từng thành phần (sen góc, dải diềm, cụm tiêu đề) bằng `generate-image`, tách nền bằng
  `remove-background`, đặt mỗi ảnh vào một trang đúng cỡ (`edit-design` `add_page` + `insert_fill`)
  rồi `export-design` PNG `transparent_background: true` (cần Canva Pro) để lấy bản gốc trong
  suốt từ `export-download.canva.com`. Nền tờ (màu, hoa văn chìm, viền vàng) vẽ thẳng ở 5600 ×
  3955 bằng PIL; ghép các thành phần bằng PIL. Sen góc dưới: tạo riêng cụm "mọc thẳng lên", đừng
  lật dọc cụm góc trên (hoa bị chúc ngược).
- Lỗi `quota_exceeded` hoặc "team admin has disabled this tool": tài khoản Canva hết lượt AI hoặc
  nhóm tắt AI; hỏi người dùng (đợi, đổi tài khoản, nâng Pro), không tự thay bằng công cụ khác.

- Canva sinh chữ tiếng Việt hay sai dấu: luôn đọc lại chữ trong thiết kế.
- Trên ảnh khung đừng để chữ cố định nào (tiêu đề, câu đối, tên): mọi chữ do ứng dụng vẽ để người
  dùng sửa được và PDF giữ chữ dạng vector.
- Giữ các id thiết kế Canva đã dùng (bản gốc, bản lớn) trong mục DECISIONS để lần sau sửa tiếp.
