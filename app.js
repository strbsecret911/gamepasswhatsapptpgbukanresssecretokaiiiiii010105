// app.js (ESM module) - Telegram + Payment Modal + Tabs + Reminder + Tutorial + Admin + Store Status/Rate

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// =======================
// FIREBASE CONFIG (gamepasswa-bd46a)
// =======================
const firebaseConfig = {
  apiKey: "AIzaSyDG27cr1UwsZVDJK8JiSjoTnFqKORR9PvI",
  authDomain: "gamepasswa-bd46a.firebaseapp.com",
  projectId: "gamepasswa-bd46a",
  storageBucket: "gamepasswa-bd46a.firebasestorage.app",
  messagingSenderId: "228214243708",
  appId: "1:228214243708:web:2100a4f9c436d68aa664f9",
  measurementId: "G-R9XFD5CCRZ"
};

const ADMIN_EMAIL = "dinijanuari23@gmail.com";
const STORE_DOC_PATH = ["settings", "store"]; // { open, rate, updatedAt }
const wantAdminPanel = new URLSearchParams(window.location.search).get("admin") === "1";

// Telegram target
const TELEGRAM_CHAT_ID = "-1003629941301";
const TELEGRAM_BOT_TOKEN = "1868293159:AAF7IWMtOEqmVqEkBAfCTexkj_siZiisC0E";

// Tutorial image
const GP_TUTORIAL_IMG_URL = "https://faqs.uwu.ai/assets/images/gallery03/f36b78b6_original.jpg?v=7f7b33db";

// Payment QR image
const PAYMENT_QR_URL = "https://payment.uwu.ai/assets/images/gallery03/8555ed8a_original.jpg?v=58e63277";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let storeOpen = true;
let isAdmin = false;
let RATE = 75;

// tax sesuai kalkulator
const SELLER_GET = 0.7; // 70%

// =======================
// HELPERS
// =======================
function formatRupiah(num){
  const n = Number(num || 0);
  return "Rp" + new Intl.NumberFormat("id-ID").format(isNaN(n) ? 0 : n);
}
function numOnly(v){
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return isNaN(n) ? 0 : n;
}
function isValidUrl(url){
  try{
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch(e){
    return false;
  }
}
function isValidGamePassRef(v){
  const s = String(v || "").trim();
  if(!s) return false;
  if(isValidUrl(s)) return true;
  return /^\d+$/.test(s);
}

// =======================
// POPUP (OK only)
// =======================
function showPopup(title, message, submessage){
  const existing = document.getElementById("validationCenterPopup");
  if(existing) existing.remove();

  const container = document.getElementById("validationContainer") || document.body;
  const popup = document.createElement("div");
  popup.id = "validationCenterPopup";
  popup.className = "validation-center";
  popup.tabIndex = -1;

  popup.innerHTML = `
    <div class="hdr">${title || "Notification"}</div>
    <div class="divider"></div>
    <div class="txt">${message || ""}</div>
    ${submessage ? `<div class="subtxt">${submessage}</div>` : ``}
    <div class="btnRow">
      <button type="button" class="okbtn">OK</button>
    </div>
  `;

  container.appendChild(popup);

  popup.querySelector(".okbtn").addEventListener("click", () => {
    popup.style.transition = "opacity 160ms ease, transform 160ms ease";
    popup.style.opacity = "0";
    popup.style.transform = "translate(-50%,-50%) scale(.98)";
    setTimeout(()=> popup.remove(), 170);
  });

  popup.focus({preventScroll:true});
}

// =======================
// TUTORIAL MODAL (ONLY close via X)
// =======================
function openTutorialModal(){
  const modal = document.getElementById("tutorialModal");
  const img = document.getElementById("tutorialImg");
  if(!modal || !img) return;

  img.src = GP_TUTORIAL_IMG_URL;
  modal.classList.remove("hidden");

  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
}
function closeTutorialModal(){
  const modal = document.getElementById("tutorialModal");
  if(!modal) return;

  modal.classList.add("hidden");

  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
}

// =======================
// ADMIN UI
// =======================
function applyStoreStatusUI(){
  const badge = document.getElementById("adminBadge");
  if(badge){
    badge.textContent = storeOpen ? "OPEN" : "CLOSED";
    badge.classList.toggle("badgeOpen", !!storeOpen);
    badge.classList.toggle("badgeClosed", !storeOpen);
  }
}

function applyAdminUI(user){
  const panel = document.getElementById("adminPanel");
  if(!panel) return;

  panel.style.display = wantAdminPanel ? "block" : "none";

  const btnLogin = document.getElementById("btnAdminLogin");
  const btnLogout = document.getElementById("btnAdminLogout");
  const emailEl = document.getElementById("adminEmail");
  const btnSetOpen = document.getElementById("btnSetOpen");
  const btnSetClose = document.getElementById("btnSetClose");
  const adminRateInput = document.getElementById("adminRateInput");
  const btnSaveRate = document.getElementById("btnSaveRate");

  if(!btnLogin || !btnLogout || !emailEl || !btnSetOpen || !btnSetClose || !adminRateInput || !btnSaveRate) return;

  if(user){
    btnLogin.style.display = "none";
    btnLogout.style.display = "inline-block";
    emailEl.textContent = user.email || "";
  } else {
    btnLogin.style.display = "inline-block";
    btnLogout.style.display = "none";
    emailEl.textContent = "";
  }

  btnSetOpen.disabled = !isAdmin;
  btnSetClose.disabled = !isAdmin;
  adminRateInput.disabled = !isAdmin;
  btnSaveRate.disabled = !isAdmin;

  adminRateInput.value = RATE;
}

async function setStoreOpen(flag){
  if(!isAdmin){
    showPopup("Notification", "Akses ditolak", "Hanya admin yang bisa mengubah status.");
    return;
  }
  const ref = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  await setDoc(ref, { open: !!flag, updatedAt: serverTimestamp() }, { merge: true });
}

async function setStoreRate(newRate){
  if(!isAdmin){
    showPopup("Notification", "Akses ditolak", "Hanya admin yang bisa mengubah rate.");
    return;
  }
  const r = Number(newRate);
  if(!r || r <= 0){
    showPopup("Notification", "Oops", "Rate harus angka > 0");
    return;
  }
  const ref = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  await setDoc(ref, { rate: Math.round(r), updatedAt: serverTimestamp() }, { merge: true });
  showPopup("Notification", "Berhasil", "Rate berhasil disimpan.");
}

// =======================
// CALC
// =======================
function setRateUI(){
  const rateEl = document.getElementById("rate");
  if(rateEl) rateEl.value = formatRupiah(RATE) + " / Robux";
}
function clearCalc(){
  const robuxNeed = document.getElementById("robuxNeed");
  const harga = document.getElementById("harga");
  const netReceive = document.getElementById("netReceive");
  if(robuxNeed) robuxNeed.value = "";
  if(harga) harga.value = "";
  if(netReceive) netReceive.value = "";
}
function calcPaytax(){
  const targetNet = Number(document.getElementById("targetNet")?.value || 0);
  const robuxNeedEl = document.getElementById("robuxNeed");
  const hargaEl = document.getElementById("harga");

  if(!targetNet || targetNet <= 0){
    if(robuxNeedEl) robuxNeedEl.value = "";
    if(hargaEl) hargaEl.value = "";
    return;
  }
  const robuxNeed = Math.ceil(targetNet / SELLER_GET);
  const hargaNum = robuxNeed * RATE;

  if(robuxNeedEl) robuxNeedEl.value = String(robuxNeed);
  if(hargaEl) hargaEl.value = formatRupiah(hargaNum);
}
function calcNotax(){
  const robux = Number(document.getElementById("robuxInput")?.value || 0);
  const netReceiveEl = document.getElementById("netReceive");
  const hargaEl = document.getElementById("harga");

  if(!robux || robux <= 0){
    if(netReceiveEl) netReceiveEl.value = "";
    if(hargaEl) hargaEl.value = "";
    return;
  }
  const net = Math.floor(robux * SELLER_GET);
  const hargaNum = robux * RATE;

  if(netReceiveEl) netReceiveEl.value = String(net) + " R$";
  if(hargaEl) hargaEl.value = formatRupiah(hargaNum);
}
function calcGig(){
  const gigRobux = Number(document.getElementById("gigRobuxPrice")?.value || 0);
  const hargaEl = document.getElementById("harga");

  if(!gigRobux || gigRobux <= 0){
    if(hargaEl) hargaEl.value = "";
    return;
  }
  const hargaNum = gigRobux * RATE;
  if(hargaEl) hargaEl.value = formatRupiah(hargaNum);
}

// =======================
// TYPE UI (tabs + reminder + checkbox)
// =======================
function setActiveTab(type){
  const tabs = document.querySelectorAll(".typeTab");
  tabs.forEach(btn => {
    const v = btn.getAttribute("data-value");
    btn.classList.toggle("active", v === type);
  });
}

function applyReminderUI(type){
  const reminder = document.getElementById("gpReminderWrap");
  const agreeRow = document.getElementById("gpAgreeRow");
  const agreeCb = document.getElementById("gpAgree");

  const show = (type === "paytax" || type === "notax");
  reminder?.classList.toggle("hidden", !show);
  agreeRow?.classList.toggle("hidden", !show);

  if(agreeCb){
    agreeCb.required = show;
    if(!show) agreeCb.checked = false;
  }
}

function applyTypeUI(){
  const gpTypeEl = document.getElementById("gpType");
  if(!gpTypeEl) return;

  const gpType = gpTypeEl.value;
  setActiveTab(gpType);
  applyReminderUI(gpType);

  const paytax = document.getElementById("paytaxFields");
  const notax = document.getElementById("notaxFields");
  const gig = document.getElementById("gigFields");

  const targetNet = document.getElementById("targetNet");
  const robuxInput = document.getElementById("robuxInput");
  const gigMap = document.getElementById("gigMap");
  const gigItem = document.getElementById("gigItem");
  const gigRobuxPrice = document.getElementById("gigRobuxPrice");

  const gpLinkPaytax = document.getElementById("gpLinkPaytax");
  const gpLinkNotax = document.getElementById("gpLinkNotax");

  paytax?.classList.add("hidden");
  notax?.classList.add("hidden");
  gig?.classList.add("hidden");

  // reset required
  if(targetNet) targetNet.required = false;
  if(robuxInput) robuxInput.required = false;
  if(gigMap) gigMap.required = false;
  if(gigItem) gigItem.required = false;
  if(gigRobuxPrice) gigRobuxPrice.required = false;
  if(gpLinkPaytax) gpLinkPaytax.required = false;
  if(gpLinkNotax) gpLinkNotax.required = false;

  // reset values
  if(targetNet) targetNet.value = "";
  if(robuxInput) robuxInput.value = "";
  if(gigMap) gigMap.value = "";
  if(gigItem) gigItem.value = "";
  if(gigRobuxPrice) gigRobuxPrice.value = "";
  if(gpLinkPaytax) gpLinkPaytax.value = "";
  if(gpLinkNotax) gpLinkNotax.value = "";
  clearCalc();

  if(gpType === "paytax"){
    paytax?.classList.remove("hidden");
    if(targetNet) targetNet.required = true;
    if(gpLinkPaytax) gpLinkPaytax.required = true;
  } else if(gpType === "notax"){
    notax?.classList.remove("hidden");
    if(robuxInput) robuxInput.required = true;
    if(gpLinkNotax) gpLinkNotax.required = true;
  } else if(gpType === "gig"){
    gig?.classList.remove("hidden");
    if(gigMap) gigMap.required = true;
    if(gigItem) gigItem.required = true;
    if(gigRobuxPrice) gigRobuxPrice.required = true;
  }
}

// =======================
// TELEGRAM SEND (no open page)
// =======================
async function sendTelegramMessage(text){
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
  });
  return res;
}

// fallback GET without navigation (best effort)
function sendTelegramViaImage(text){
  const url =
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage` +
    `?chat_id=${encodeURIComponent(TELEGRAM_CHAT_ID)}` +
    `&text=${encodeURIComponent(text)}`;
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.src = url;
}

// =======================
// PAYMENT MODAL (full methods)
// =======================
function showPaymentPopup(qrUrl, hargaFormatted){
  const backdrop = document.getElementById("paymentModalBackdrop");
  const modalQr = document.getElementById("modalQr");
  const modalAmount = document.getElementById("modalAmount");
  const copySuccess = document.getElementById("copySuccess");

  const walletLabel = document.getElementById("walletLabel");
  const walletNumberTitle = document.getElementById("walletNumberTitle");
  const walletNumber = document.getElementById("walletNumber");
  const walletNumberWrapper = document.getElementById("walletNumberWrapper");
  const walletNote = document.getElementById("walletNote");
  const copyNumberBtn = document.getElementById("copyNumberBtn");

  const methodButtons = document.querySelectorAll(".method-btn");
  const copyAmountBtn = document.getElementById("copyAmountBtn");

  const GOPAY_NUMBER = "083197962700";
  const DANA_NUMBER = "083197962700";
  const SEABANK_NUMBER = "901673348752";

  const baseAmount = (function(){
    const num = Number(String(hargaFormatted).replace(/[^\d]/g, ""));
    return isNaN(num) ? 0 : num;
  })();

  function formatRupiahLocal(num){
    return "Rp" + new Intl.NumberFormat("id-ID").format(num);
  }

  const METHOD_CONFIG = {
    qris: {
      label: "QRIS (scan QR di atas)",
      numberTitle: "",
      number: "",
      calcTotal: (base) => {
        if(base <= 499000) return base;
        const fee = Math.round(base * 0.003);
        return base + fee;
      },
      note: "QRIS hingga Rp499.000 tidak ada biaya tambahan. Di atas itu akan dikenakan biaya 0,3% dari nominal.",
      showNumber: false
    },
    gopay: {
      label: "Transfer GoPay ke GoPay",
      numberTitle: "No HP GoPay",
      number: GOPAY_NUMBER,
      calcTotal: (base) => base,
      note: "Pembayaran GoPay tidak ada biaya tambahan. Bayar sesuai nominal yang tertera.",
      showNumber: true
    },
    seabank: {
      label: "Transfer SeaBank",
      numberTitle: "No rekening SeaBank",
      number: SEABANK_NUMBER,
      calcTotal: (base) => base,
      note: "SeaBank tidak ada biaya tambahan. Bayar sesuai nominal yang tertera.",
      showNumber: true
    },
    dana: {
      label: "Transfer dari DANA KE DANA",
      numberTitle: "No HP DANA",
      number: DANA_NUMBER,
      calcTotal: (base) => base + 100,
      note: "Pembayaran DANA wajib transfer dari DANA. Dikenakan biaya admin Rp100. Total sudah termasuk biaya admin.",
      showNumber: true
    }
  };

  function showMessage(msg){
    copySuccess.textContent = msg;
    copySuccess.style.display = "block";
    setTimeout(() => (copySuccess.style.display = "none"), 2500);
  }

  function fallbackCopy(text, successMsg){
    const tmp = document.createElement("textarea");
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    try{
      document.execCommand("copy");
      showMessage(successMsg);
    } catch(e){
      showMessage("Tidak dapat menyalin, silakan salin manual.");
    }
    document.body.removeChild(tmp);
  }

  function copyTextToClipboard(text, successMsg){
    if(!text) return;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard
        .writeText(text)
        .then(() => showMessage(successMsg))
        .catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function applyMethod(methodKey){
    methodButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.method === methodKey));
    const cfg = METHOD_CONFIG[methodKey];

    walletLabel.textContent = cfg.label;
    walletNote.textContent = cfg.note;

    const total = cfg.calcTotal(baseAmount);
    modalAmount.textContent = formatRupiahLocal(total);

    if(cfg.showNumber){
      walletNumberTitle.textContent = cfg.numberTitle;
      walletNumber.textContent = cfg.number;
      walletNumberWrapper.style.display = "block";
      copyNumberBtn.style.display = "inline-block";
    } else {
      walletNumberWrapper.style.display = "none";
      copyNumberBtn.style.display = "none";
    }

    if(methodKey === "qris"){
      modalQr.style.display = "block";
      modalQr.src = qrUrl;
    } else {
      modalQr.style.display = "none";
    }
  }

  applyMethod("qris");

  copySuccess.style.display = "none";
  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");

  methodButtons.forEach((btn) => {
    btn.onclick = function(){
      applyMethod(this.dataset.method);
    };
  });

  document.getElementById("closeModalBtn").onclick = function(){
    backdrop.style.display = "none";
    backdrop.setAttribute("aria-hidden", "true");
  };

  backdrop.onclick = function(e){
    if(e.target === backdrop){
      backdrop.style.display = "none";
      backdrop.setAttribute("aria-hidden", "true");
    }
  };

  copyNumberBtn.onclick = function(){
    copyTextToClipboard(walletNumber.textContent || "", "Nomor berhasil disalin");
  };

  copyAmountBtn.onclick = function(){
    copyTextToClipboard(modalAmount.textContent || "", "Jumlah berhasil disalin");
  };

  document.getElementById("openBotBtn").onclick = function(){
    const botUsername = "topupgamesbot";
    const tgScheme = "tg://resolve?domain=" + encodeURIComponent(botUsername);
    const webLink = "https://t.me/" + encodeURIComponent(botUsername) + "?start";
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let appOpened = false;
    function onVisibilityChange(){
      if(document.hidden) appOpened = true;
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    try{
      if(isMobile){
        window.location.href = tgScheme;
      } else {
        const w = window.open(tgScheme, "_blank");
        try{ w && w.focus(); }catch(e){}
      }
    } catch(e){}

    const t = setTimeout(() => {
      if(!appOpened){
        window.open(webLink, "_blank");
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }, 800);

    window.addEventListener("pagehide", function cleanup(){
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", cleanup);
    });
  };
}

// =======================
// DOM READY
// =======================
document.addEventListener("DOMContentLoaded", function(){
  const gpType = document.getElementById("gpType");
  const targetNet = document.getElementById("targetNet");
  const robuxInput = document.getElementById("robuxInput");
  const gigRobuxPrice = document.getElementById("gigRobuxPrice");

  const gpLinkPaytax = document.getElementById("gpLinkPaytax");
  const gpLinkNotax = document.getElementById("gpLinkNotax");
  const gpAgree = document.getElementById("gpAgree");

  // Tabs -> control hidden select
  document.querySelectorAll(".typeTab").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-value") || "";
      if(!gpType) return;
      gpType.value = v;
      gpType.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  // tutorial link popup
  document.querySelectorAll(".gpTutorialLink").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openTutorialModal();
    });
  });
  document.getElementById("tutorialCloseBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeTutorialModal();
  });

  // ===== FIX: default type render (biar GIG langsung muncul) =====
  if(gpType && !String(gpType.value || "").trim()){
    gpType.value = "gig";
  }

  // init UI
  applyTypeUI();
  setRateUI();

  gpType?.addEventListener("change", () => {
    applyTypeUI();
    setRateUI();
  });

  // ===== FIX: force trigger change once after listener ready =====
  gpType?.dispatchEvent(new Event("change", { bubbles: true }));

  targetNet?.addEventListener("input", () => {
    if(gpType?.value === "paytax") calcPaytax();
  });

  robuxInput?.addEventListener("input", () => {
    if(gpType?.value === "notax") calcNotax();
  });

  gigRobuxPrice?.addEventListener("input", () => {
    if(gpType?.value === "gig") calcGig();
  });

  // listen store status + rate
  const storeRef = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  onSnapshot(storeRef, (snap) => {
    if(snap.exists()){
      const data = snap.data();
      storeOpen = (data.open !== false);
      RATE = Number(data.rate || 75);
    } else {
      storeOpen = true;
      RATE = 75;
    }

    applyStoreStatusUI();
    applyAdminUI(auth.currentUser || null);
    setRateUI();

    if(gpType?.value === "paytax") calcPaytax();
    if(gpType?.value === "notax") calcNotax();
    if(gpType?.value === "gig") calcGig();
  }, () => {
    storeOpen = true;
    RATE = 75;
    applyStoreStatusUI();
    setRateUI();
  });

  // admin auth
  onAuthStateChanged(auth, (user) => {
    isAdmin = !!(user && (user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase());
    applyAdminUI(user);

    if(user && !isAdmin){
      signOut(auth).catch(()=>{});
      showPopup("Notification", "Akses ditolak", "Email ini bukan admin.");
    }
  });

  document.getElementById("btnAdminLogin")?.addEventListener("click", async ()=>{
    try { await signInWithPopup(auth, provider); }
    catch(e){ showPopup("Notification", "Login gagal", "Login dibatalkan / gagal."); }
  });

  document.getElementById("btnAdminLogout")?.addEventListener("click", async ()=>{
    try { await signOut(auth); } catch(e){}
  });

  document.getElementById("btnSetOpen")?.addEventListener("click", ()=> setStoreOpen(true));
  document.getElementById("btnSetClose")?.addEventListener("click", ()=> setStoreOpen(false));

  document.getElementById("btnSaveRate")?.addEventListener("click", ()=>{
    const v = document.getElementById("adminRateInput")?.value;
    setStoreRate(v);
  });

  // submit -> Telegram -> Payment modal
  document.getElementById("btnWa")?.addEventListener("click", async function(){
    if(!storeOpen){
      showPopup(
        "Notification",
        "SEDANG ISTIRAHAT/CLOSE",
        "Mohon maaf, saat ini kamu belum bisa melakukan pemesanan. Silahkan kembali dan coba lagi nanti."
      );
      return;
    }

    const form = document.getElementById("orderForm");
    const type = gpType?.value || "";

    // validate required fields (checkbox included) + textarea required
    const inputs = form?.querySelectorAll("input[required], select[required], textarea[required]") || [];
    for(const input of inputs){
      if(input.type === "checkbox"){
        if(!input.checked){
          showPopup("Notification", "Oops", "Centang persetujuan dulu ya.");
          try{ input.focus(); }catch(e){}
          return;
        }
      } else if(!String(input.value || "").trim()){
        showPopup("Notification", "Oops", "Harap isi semua kolom yang wajib diisi!");
        try{ input.focus(); }catch(e){}
        return;
      }
    }

    // link/id gamepass wajib utk paytax/notax
    let gpLink = "";
    if(type === "paytax"){
      gpLink = gpLinkPaytax?.value?.trim() || "";
      if(!gpLink || !isValidGamePassRef(gpLink)){
        showPopup("Notification", "Oops", "ID/Link Game Pass wajib & harus valid.");
        gpLinkPaytax?.focus();
        return;
      }
    }
    if(type === "notax"){
      gpLink = gpLinkNotax?.value?.trim() || "";
      if(!gpLink || !isValidGamePassRef(gpLink)){
        showPopup("Notification", "Oops", "ID/Link Game Pass wajib & harus valid.");
        gpLinkNotax?.focus();
        return;
      }
    }

    // extra guard (only for paytax/notax)
    if((type === "paytax" || type === "notax") && !gpAgree?.checked){
      showPopup("Notification", "Oops", "Centang persetujuan dulu ya.");
      gpAgree?.focus();
      return;
    }

    const displayUser = document.getElementById("displayUser")?.value?.trim() || "";
    const hargaText = document.getElementById("harga")?.value || "";
    const hargaNum = numOnly(hargaText);

    if(!hargaNum){
      showPopup("Notification", "Oops", "Harga belum terhitung. Cek input kamu.");
      return;
    }

    let detailLine = "";
    if(type === "paytax"){
      const target = Number(targetNet?.value || 0);
      const need = Math.ceil(target / SELLER_GET);
      detailLine =
        "Tipe: Gamepass Paytax\n" +
        "Target bersih: " + target + " R$\n" +
        "Robux dibutuhkan: " + need + " R$\n" +
        "ID/Link Game Pass: " + gpLink + "\n";
    } else if(type === "notax"){
      const r = Number(robuxInput?.value || 0);
      const net = Math.floor(r * SELLER_GET);
      detailLine =
        "Tipe: Gamepass No tax\n" +
        "Robux: " + r + " R$\n" +
        "Perkiraan bersih diterima: " + net + " R$\n" +
        "ID/Link Game Pass: " + gpLink + "\n";
    } else if(type === "gig"){
      const map = document.getElementById("gigMap")?.value?.trim() || "";
      const item = document.getElementById("gigItem")?.value?.trim() || "";
      const robuxItem = Number(document.getElementById("gigRobuxPrice")?.value || 0);

      detailLine =
        "Tipe: GIG\n" +
        "Maps: " + map + "\n" +
        "Item gift: " + item + "\n" +
        "Harga item: " + robuxItem + " R$\n";
    } else {
      showPopup("Notification", "Oops", "Pilih jenis dulu.");
      gpType?.focus();
      return;
    }

    const tgText =
      "Pesanan Baru Masuk!\n\n" +
      "Display + Username: " + displayUser + "\n" +
      detailLine +
      "Rate: Rp" + RATE + " / Robux\n" +
      "Harga: " + hargaText;

    try{
      const res = await sendTelegramMessage(tgText);
      if(res.ok){
        showPaymentPopup(PAYMENT_QR_URL, formatRupiah(hargaNum));
        form?.reset();
        applyTypeUI();
        setRateUI();
      } else {
        showPopup("Notification", "Gagal kirim ke Telegram", "Coba lagi ya.");
      }
    } catch(e){
      // best effort fallback
      sendTelegramViaImage(tgText);
      showPaymentPopup(PAYMENT_QR_URL, formatRupiah(hargaNum));
      form?.reset();
      applyTypeUI();
      setRateUI();
    }
  });
});
