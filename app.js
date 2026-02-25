// app.js (ESM module) - WhatsApp version (no payment modal)

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

// WhatsApp target number (Indonesia) -> 62...
const WHATSAPP_NUMBER = "6283197962700";

// Tutorial image (popup)
const GP_TUTORIAL_IMG_URL = "https://faqs.uwu.ai/assets/images/gallery03/f36b78b6_original.jpg?v=7f7b33db";

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
  return "Rp" + new Intl.NumberFormat('id-ID').format(isNaN(n) ? 0 : n);
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
  // allow ID only (digits)
  return /^\d+$/.test(s);
}

// =======================
// POPUP (OK only)
// =======================
function showPopup(title, message, submessage){
  const existing = document.getElementById('validationCenterPopup');
  if(existing) existing.remove();

  const container = document.getElementById('validationContainer') || document.body;
  const popup = document.createElement('div');
  popup.id = 'validationCenterPopup';
  popup.className = 'validation-center';
  popup.tabIndex = -1;

  popup.innerHTML = `
    <div class="hdr">${title || 'Notification'}</div>
    <div class="divider"></div>
    <div class="txt">${message || ''}</div>
    ${submessage ? `<div class="subtxt">${submessage}</div>` : ``}
    <div class="btnRow">
      <button type="button" class="okbtn">OK</button>
    </div>
  `;

  container.appendChild(popup);

  popup.querySelector('.okbtn').addEventListener('click', () => {
    popup.style.transition = 'opacity 160ms ease, transform 160ms ease';
    popup.style.opacity = '0';
    popup.style.transform = 'translate(-50%,-50%) scale(.98)';
    setTimeout(()=> popup.remove(), 170);
  });

  popup.focus({preventScroll:true});
}

// =======================
// TUTORIAL MODAL (image)
// =======================
function openTutorialModal(){
  const modal = document.getElementById('tutorialModal');
  const img = document.getElementById('tutorialImg');
  if(!modal || !img) return;

  img.src = GP_TUTORIAL_IMG_URL;
  modal.classList.remove('hidden');

  // lock scroll (optional)
  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');
}
function closeTutorialModal(){
  const modal = document.getElementById('tutorialModal');
  if(!modal) return;

  modal.classList.add('hidden');

  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
}

// =======================
// ADMIN UI
// =======================
function applyStoreStatusUI(){
  const badge = document.getElementById('adminBadge');
  if(badge){
    badge.textContent = storeOpen ? 'OPEN' : 'CLOSED';
    badge.style.borderColor = storeOpen ? '#bbf7d0' : '#fecaca';
    badge.style.background = storeOpen ? '#ecfdf5' : '#fef2f2';
    badge.style.color = storeOpen ? '#14532d' : '#7f1d1d';
  }
}

function applyAdminUI(user){
  const panel = document.getElementById('adminPanel');
  if(!panel) return;

  panel.style.display = wantAdminPanel ? 'block' : 'none';

  const btnLogin = document.getElementById('btnAdminLogin');
  const btnLogout = document.getElementById('btnAdminLogout');
  const emailEl = document.getElementById('adminEmail');
  const btnSetOpen = document.getElementById('btnSetOpen');
  const btnSetClose = document.getElementById('btnSetClose');
  const adminRateInput = document.getElementById('adminRateInput');
  const btnSaveRate = document.getElementById('btnSaveRate');

  if(!btnLogin || !btnLogout || !emailEl || !btnSetOpen || !btnSetClose || !adminRateInput || !btnSaveRate) return;

  if(user){
    btnLogin.style.display = 'none';
    btnLogout.style.display = 'inline-block';
    emailEl.textContent = user.email || '';
  } else {
    btnLogin.style.display = 'inline-block';
    btnLogout.style.display = 'none';
    emailEl.textContent = '';
  }

  btnSetOpen.disabled = !isAdmin;
  btnSetClose.disabled = !isAdmin;
  adminRateInput.disabled = !isAdmin;
  btnSaveRate.disabled = !isAdmin;

  adminRateInput.value = RATE;
}

async function setStoreOpen(flag){
  if(!isAdmin){
    showPopup('Notification', 'Akses ditolak', 'Hanya admin yang bisa mengubah status.');
    return;
  }
  const ref = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  await setDoc(ref, { open: !!flag, updatedAt: serverTimestamp() }, { merge: true });
}

async function setStoreRate(newRate){
  if(!isAdmin){
    showPopup('Notification', 'Akses ditolak', 'Hanya admin yang bisa mengubah rate.');
    return;
  }
  const r = Number(newRate);
  if(!r || r <= 0){
    showPopup('Notification', 'Oops', 'Rate harus angka > 0');
    return;
  }
  const ref = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  await setDoc(ref, { rate: Math.round(r), updatedAt: serverTimestamp() }, { merge: true });
  showPopup('Notification', 'Berhasil', 'Rate berhasil disimpan.');
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
// TYPE UI
// =======================
function setActiveTab(type){
  const tabs = document.querySelectorAll('.typeTab');
  tabs.forEach(btn => {
    const v = btn.getAttribute('data-value');
    if(v === type) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function applyTypeUI(){
  const gpTypeEl = document.getElementById("gpType");
  if(!gpTypeEl) return;

  const gpType = gpTypeEl.value;
  setActiveTab(gpType);

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
// WHATSAPP SEND
// =======================
function openWhatsAppWithText(text){
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

// =======================
// DOM READY
// =======================
document.addEventListener('DOMContentLoaded', function(){
  const gpType = document.getElementById("gpType");
  const targetNet = document.getElementById("targetNet");
  const robuxInput = document.getElementById("robuxInput");
  const gigRobuxPrice = document.getElementById("gigRobuxPrice");

  const gpLinkPaytax = document.getElementById("gpLinkPaytax");
  const gpLinkNotax = document.getElementById("gpLinkNotax");

  // Tabs -> set gpType value
  const tabs = document.querySelectorAll('.typeTab');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-value') || '';
      if(!gpType) return;
      gpType.value = v;
      gpType.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // Tutorial link -> open modal (only close via X)
  document.querySelectorAll('.gpTutorialLink').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openTutorialModal();
    });
  });
  document.getElementById('tutorialCloseBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeTutorialModal();
  });

  applyTypeUI();
  setRateUI();

  gpType?.addEventListener("change", () => {
    applyTypeUI();
    setRateUI();
  });

  targetNet?.addEventListener("input", () => {
    if (gpType?.value === "paytax") calcPaytax();
  });

  robuxInput?.addEventListener("input", () => {
    if (gpType?.value === "notax") calcNotax();
  });

  gigRobuxPrice?.addEventListener("input", () => {
    if (gpType?.value === "gig") calcGig();
  });

  // listen store status + rate
  const storeRef = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  onSnapshot(storeRef, (snap) => {
    if (snap.exists()) {
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

    if (gpType?.value === "paytax") calcPaytax();
    if (gpType?.value === "notax") calcNotax();
    if (gpType?.value === "gig") calcGig();
  }, () => {
    storeOpen = true;
    RATE = 75;
    applyStoreStatusUI();
    setRateUI();
  });

  // admin auth
  onAuthStateChanged(auth, (user) => {
    isAdmin = !!(user && (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase());
    applyAdminUI(user);

    if (user && !isAdmin) {
      signOut(auth).catch(()=>{});
      showPopup('Notification', 'Akses ditolak', 'Email ini bukan admin.');
    }
  });

  document.getElementById('btnAdminLogin')?.addEventListener('click', async ()=>{
    try { await signInWithPopup(auth, provider); }
    catch(e){ showPopup('Notification', 'Login gagal', 'Login dibatalkan / gagal.'); }
  });

  document.getElementById('btnAdminLogout')?.addEventListener('click', async ()=>{
    try { await signOut(auth); } catch(e){}
  });

  document.getElementById('btnSetOpen')?.addEventListener('click', ()=> setStoreOpen(true));
  document.getElementById('btnSetClose')?.addEventListener('click', ()=> setStoreOpen(false));

  document.getElementById('btnSaveRate')?.addEventListener('click', ()=>{
    const v = document.getElementById('adminRateInput')?.value;
    setStoreRate(v);
  });

  // submit -> WhatsApp
  document.getElementById("btnWa")?.addEventListener("click", function() {
    if (!storeOpen) {
      showPopup(
        'Notification',
        'SEDANG ISTIRAHAT/CLOSE',
        'Mohon maaf, saat ini kamu belum bisa melakukan pemesanan. Silahkan kembali dan coba lagi nanti.'
      );
      return;
    }

    const form = document.getElementById("orderForm");
    const type = gpType?.value || '';

    // validate required fields
    const inputs = form?.querySelectorAll("input[required], select[required]") || [];
    for (const input of inputs) {
      if (!String(input.value || '').trim()) {
        showPopup('Notification', 'Oops', 'Harap isi semua kolom yang wajib diisi!');
        try{ input.focus(); }catch(e){}
        return;
      }
    }

    // gamepass ref wajib utk paytax/notax
    let gpLink = "";
    if(type === "paytax"){
      gpLink = gpLinkPaytax?.value?.trim() || "";
      if(!gpLink || !isValidGamePassRef(gpLink)){
        showPopup('Notification', 'Oops', 'ID/Link Game Pass wajib & harus valid.');
        gpLinkPaytax?.focus();
        return;
      }
    }
    if(type === "notax"){
      gpLink = gpLinkNotax?.value?.trim() || "";
      if(!gpLink || !isValidGamePassRef(gpLink)){
        showPopup('Notification', 'Oops', 'ID/Link Game Pass wajib & harus valid.');
        gpLinkNotax?.focus();
        return;
      }
    }

    const displayUser = document.getElementById("displayUser")?.value?.trim() || '';
    const hargaText = document.getElementById("harga")?.value || '';
    const hargaNum = numOnly(hargaText);

    if(!hargaNum){
      showPopup('Notification', 'Oops', 'Harga belum terhitung. Cek input kamu.');
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
      const map = document.getElementById("gigMap")?.value?.trim() || '';
      const item = document.getElementById("gigItem")?.value?.trim() || '';
      const robuxItem = Number(document.getElementById("gigRobuxPrice")?.value || 0);

      detailLine =
        "Tipe: GIG\n" +
        "Maps: " + map + "\n" +
        "Item gift: " + item + "\n" +
        "Harga item: " + robuxItem + " R$\n";
    } else {
      showPopup('Notification', 'Oops', 'Pilih jenis dulu.');
      gpType?.focus();
      return;
    }

    const waText =
      "Pesanan Baru Masuk!\n\n" +
      "Display + Username: " + displayUser + "\n" +
      detailLine +
      "Rate: Rp" + RATE + " / Robux\n" +
      "Harga: " + hargaText;

    openWhatsAppWithText(waText);

    // optional: reset form setelah open wa
    form?.reset();
    applyTypeUI();
    setRateUI();
  });
});
