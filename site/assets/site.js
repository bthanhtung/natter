import { PLATFORMS, RELEASES_API, RELEASES_PAGE, detectOS, formatSize, primaryPlatform, sortAssets } from "../releases.js";

const VI = {
  skip: "Bỏ qua, tới nội dung",
  navFeatures: "Tính năng", navDownload: "Tải về", navFaq: "Hỏi đáp",
  heroTitle: "Messenger trên máy tính, không kèm phần còn lại của Facebook.",
  heroLede: "Meta đã đóng app Messenger cho máy tính từ tháng 12/2025. Natter mang lại một cửa sổ yên tĩnh, chỉ có các đoạn chat của bạn.",
  ctaAll: "Xem tất cả bản tải",
  heroFine: "Miễn phí. Không chính thức, không liên kết với Meta.",
  demoCaption: "Bản demo với các đoạn chat mẫu.",
  featuresTitle: "Chỉ làm một việc.",
  f1: "Chỉ có chat", f1d: "Không bảng tin, không reels, không thanh đầu trang của Facebook. Trang cá nhân và bài viết mở trong trình duyệt.",
  f2: "Gọi thoại và video", f2d: "Natter gọi được trong mọi đoạn chat, kể cả chat mã hoá đầu cuối.",
  f3: "Huy hiệu chưa đọc rõ ràng", f3d: "Trên Dock hoặc thanh tác vụ và ở khay hệ thống, đếm theo số đoạn chat.",
  f4: "Thông báo theo ý bạn", f4d: "Không làm phiền, ẩn nội dung xem trước, tuỳ chọn âm thanh.",
  f5: "Giao diện", f5d: "Theo Facebook hoặc chọn Hệ thống, Sáng, Xám, Tối đen tuyền, Tương phản cao, không cần tải lại.",
  f6: "Không chiếm chỗ", f6d: "Nằm ở thanh menu hoặc khay hệ thống, mở cùng máy, đính kèm file bằng kéo thả hoặc dán.",
  downloadTitle: "Tải về",
  loading: "Đang kiểm tra bản mới nhất…",
  natterPitch: "Chạy trên Chromium. Chọn bản này nếu bạn hay gọi.",
  litePitch: "Chạy trên webview của hệ điều hành, khoảng 10 MB. Trên macOS và Linux, gọi trong chat mã hoá sẽ mở ở trình duyệt.",
  colSystem: "Hệ điều hành",
  unsigned: "Các bản cài chưa được ký số nên lần mở đầu sẽ có cảnh báo. Trên macOS vào System Settings → Privacy & Security → Open Anyway. Trên Windows bấm More info → Run anyway.",
  trustTitle: "Natter làm gì với tài khoản của bạn",
  doesTitle: "Chỉ hiển thị trang của chính Meta",
  doesText: "Natter mở facebook.com/messages trong cửa sổ riêng, chỉnh giao diện bằng CSS và một script nhỏ, rồi chuyển thông báo sang hệ điều hành. Phiên đăng nhập nằm trong thư mục dữ liệu riêng của app.",
  doesntTitle: "Không đụng tới những thứ khác",
  n1: "Không sửa code của Facebook", n2: "Không scrape, không tự động hoá", n3: "Không đọc hay lưu tin nhắn", n4: "Không analytics, quảng cáo hay máy chủ riêng",
  faqTitle: "Câu hỏi thường gặp",
  q1: "Natter có phải do Meta làm không?", a1: "Không. Natter là dự án độc lập, không liên kết và không được Meta bảo trợ.",
  q2: "Tài khoản có bị khoá không?", a2: "Natter tải đúng trang bạn mở trên trình duyệt và không tự động hoá gì. Nhưng như mọi app bên thứ ba, không có gì đảm bảo tuyệt đối.",
  q3: "Nên chọn bản nào?", a3: "Natter nếu bạn hay gọi. Natter Lite nếu chủ yếu nhắn tin và muốn thật nhẹ. Hai bản cài song song được, mỗi bản đăng nhập riêng.",
  q4: "Vì sao phải đăng nhập lại và nhập PIN?", a4: "Facebook coi mỗi lần cài là một thiết bị mới. Mã PIN Messenger giúp khôi phục lịch sử chat mã hoá.",
  footer: "Natter là dự án không chính thức. Messenger và Facebook là thương hiệu của Meta Platforms, Inc.",
};

const WORDS = {
  en: {
    download: (name) => `Download for ${name}`, latest: (v, d) => `Latest: ${v}, ${d}`, none: "Not in this release",
    soon: "No public release yet. Downloads appear here once one is published.", busy: "GitHub is busy right now.", openReleases: "Open the releases page",
    orLite: "Prefer the small one?", linuxPick: "Pick your distribution below.", mobile: "Natter is for computers, so open this page on one.", lang: "VI", langName: "Tiếng Việt",
  },
  vi: {
    download: (name) => `Tải cho ${name}`, latest: (v, d) => `Mới nhất: ${v}, ${d}`, none: "Chưa có ở bản này",
    soon: "Chưa có bản phát hành công khai. Nút tải sẽ hiện ở đây ngay khi có.", busy: "GitHub đang bận.", openReleases: "Mở trang phát hành",
    orLite: "Muốn bản nhẹ?", linuxPick: "Chọn bản phân phối của bạn ở bảng dưới.", mobile: "Natter dành cho máy tính, hãy mở trang này trên máy tính.", lang: "EN", langName: "English",
  },
};

const $ = (s) => document.querySelector(s);
const store = {
  get(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* the page works without it */ } },
};
const saved = (() => { try { return localStorage.getItem("lang"); } catch { return null; } })();
let lang = saved ?? (navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en");

const english = Object.fromEntries([...document.querySelectorAll("[data-t]")].map((el) => [el.dataset.t, el.textContent]));
const os = detectOS(navigator.platform, navigator.userAgent);
let release = null;   // { tag, date, groups, public } once fetched
let state = "loading"; // loading | ready | none | busy

function link(asset, label) {
  const a = document.createElement("a");
  a.className = "button";
  a.href = asset.browser_download_url;
  a.textContent = label;
  if (asset.size) {
    const size = document.createElement("small");
    size.textContent = formatSize(asset.size);
    a.append(size);
  }
  return a;
}

function renderRows() {
  const w = WORDS[lang];
  $("#rows").replaceChildren(...PLATFORMS.map((p) => {
    const row = document.createElement("tr");
    row.classList.toggle("mine", p.os === os);
    const system = document.createElement("td");
    system.innerHTML = `<span class="sys"></span><span class="sub"></span>`;
    system.firstChild.textContent = p.name;
    system.lastChild.textContent = p.note;
    const cells = ["natter", "lite"].map((channel) => {
      const cell = document.createElement("td");
      const asset = release?.groups[channel][p.id];
      if (asset) cell.append(link(asset, `${lang === "vi" ? "Tải" : "Get"} ${channel === "lite" ? "Natter Lite" : "Natter"}`));
      else {
        const none = document.createElement("span");
        none.className = "none";
        none.textContent = state === "ready" ? w.none : "—";
        cell.append(none);
      }
      return cell;
    });
    row.append(system, ...cells);
    return row;
  }));
}

function renderPrimary() {
  const w = WORDS[lang];
  const button = $("#primary");
  const note = $("#primary-note");
  const id = primaryPlatform(os);
  const asset = id && release?.groups.natter[id];
  button.href = asset?.browser_download_url ?? "#download";
  if (asset) {
    button.textContent = w.download(PLATFORMS.find((p) => p.id === id).name);
    const size = document.createElement("small");
    size.textContent = formatSize(asset.size ?? 0);
    if (asset.size) button.append(size);
  } else button.textContent = lang === "vi" ? VI.ctaAll : english.ctaAll;
  note.replaceChildren();
  const lite = id && release?.groups.lite[id];
  if (lite) {
    const a = document.createElement("a");
    a.href = lite.browser_download_url;
    a.textContent = `Natter Lite${lite.size ? `, ${formatSize(lite.size)}` : ""}`;
    note.append(`${w.orLite} `, a);
  } else if (os === "linux" && state === "ready") note.textContent = w.linuxPick;
  else if (os === "mobile") note.textContent = w.mobile;
}

function renderState() {
  const w = WORDS[lang];
  const el = $("#release-state");
  el.classList.toggle("waiting", state === "none" || state === "busy");
  if (state === "loading") el.textContent = lang === "vi" ? VI.loading : english.loading;
  if (state === "none") el.textContent = w.soon;
  if (state === "ready") el.textContent = w.latest(release.tag, new Date(release.date).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }));
  if (state === "busy") {
    el.textContent = `${w.busy} `;
    const a = document.createElement("a");
    a.href = RELEASES_PAGE;
    a.textContent = w.openReleases;
    el.append(a);
  }
}

function applyLanguage() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-t]")) {
    if (el.id === "release-state" || el.id === "primary") continue;
    el.textContent = (lang === "vi" ? VI : english)[el.dataset.t];
  }
  const button = $("#lang");
  button.textContent = WORDS[lang].lang;
  button.setAttribute("aria-label", WORDS[lang].langName);
  renderState();
  renderPrimary();
  renderRows();
}

async function loadRelease() {
  const cached = store.get("release");
  if (cached && Date.now() - cached.at < 600000) return cached.data;
  const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
  if (response.status === 404) return { missing: true };
  if (!response.ok) throw new Error(String(response.status));
  const { tag_name: tag, published_at: date, assets } = await response.json();
  const data = { tag, date, assets: assets.map(({ name, size, browser_download_url }) => ({ name, size, browser_download_url })) };
  store.set("release", { at: Date.now(), data });
  return data;
}

$("#lang").addEventListener("click", () => {
  lang = lang === "vi" ? "en" : "vi";
  try { localStorage.setItem("lang", lang); } catch { /* remembered for this page only */ }
  applyLanguage();
});

applyLanguage();
loadRelease().then(
  (data) => {
    if (data.missing || !data.assets.length) state = "none";
    else {
      release = { ...data, groups: sortAssets(data.assets) };
      state = "ready";
      document.querySelectorAll(".source").forEach((el) => (el.hidden = false));
    }
    applyLanguage();
  },
  () => {
    state = "busy";
    applyLanguage();
  },
);
