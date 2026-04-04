/**
 * app.js — Travel Globe v2: Multi-user, tabs, 2D/3D maps.
 */

const API_BASE = "";
const API = {
  login: `${API_BASE}/api/login`,
  register: `${API_BASE}/api/register`,
  me: `${API_BASE}/api/me`,
  trips: `${API_BASE}/api/trips`,
  adminUsers: `${API_BASE}/api/admin/users`,
  adminStats: `${API_BASE}/api/admin/stats`,
};

// ─── State ───────────────────────────────────────────────────────
let token = null;
let currentUser = null;
let trips = [];
let globe = null;
let leafletMap = null;
let leafletLayers = {};
let geoData = null;
let currentTab = "globe";
let currentMapStyle = "grayscale";

// ─── DOM ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// Auth
const authScreen = $("authScreen");
const mainApp = $("mainApp");
const loginForm = $("loginForm");
const registerForm = $("registerForm");

// Nav
const menuBtn = $("menuBtn");
const navOverlay = $("navOverlay");
const navMenu = $("navMenu");
const navUser = $("navUser");
const navAdminBtn = $("navAdminBtn");

// Tabs
const tabGlobe = $("tabGlobe");
const tabMap2d = $("tabMap2d");
const tabList = $("tabList");
const tabAdmin = $("tabAdmin");
const tabs = { globe: tabGlobe, map2d: tabMap2d, list: tabList, admin: tabAdmin };

// Sheets
const sheetOverlay = $("sheetOverlay");
const tripSheet = $("tripSheet");
const sheetTitle = $("sheetTitle");
const sheetBody = $("sheetBody");
const formOverlay = $("formOverlay");
const formSheet = $("formSheet");
const formSheetTitle = $("formSheetTitle");
const formSheetBody = $("formSheetBody");

const lightbox = $("lightbox");
const lightboxImg = $("lightboxImg");
const hintBadge = $("hintBadge");
const fab = $("fabAdd");


// ═══════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════
$("showRegister").onclick = e => { e.preventDefault(); loginForm.style.display = "none"; registerForm.style.display = "block"; };
$("showLogin").onclick = e => { e.preventDefault(); registerForm.style.display = "none"; loginForm.style.display = "block"; };

loginForm.onsubmit = async e => {
  e.preventDefault();
  $("loginError").textContent = "";
  const body = { username: $("loginUsername").value, password: $("loginPassword").value };
  try {
    const res = await fetch(API.login, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { $("loginError").textContent = (await res.json()).detail || "Ошибка"; return; }
    const data = await res.json();
    onAuth(data);
  } catch { $("loginError").textContent = "Ошибка сети"; }
};

registerForm.onsubmit = async e => {
  e.preventDefault();
  $("regError").textContent = "";
  const body = { username: $("regUsername").value, password: $("regPassword").value };
  try {
    const res = await fetch(API.register, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { $("regError").textContent = (await res.json()).detail || "Ошибка"; return; }
    const data = await res.json();
    onAuth(data);
  } catch { $("regError").textContent = "Ошибка сети"; }
};

function onAuth(data) {
  token = data.access_token;
  currentUser = { id: data.user_id, username: data.username, role: data.role };
  authScreen.style.display = "none";
  mainApp.style.display = "block";
  navUser.textContent = `${currentUser.username}`;
  if (currentUser.role === "admin") navAdminBtn.style.display = "flex";
  loadApp();
}

$("btnLogout").onclick = () => {
  token = null; currentUser = null;
  authScreen.style.display = "grid"; mainApp.style.display = "none";
  loginForm.style.display = "block"; registerForm.style.display = "none";
  $("loginUsername").value = ""; $("loginPassword").value = "";
  if (globe) { $("globe-container").innerHTML = ""; globe = null; }
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  closeMenu();
};


// ═══════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════
function openMenu() { navOverlay.classList.add("open"); navMenu.classList.add("open"); }
function closeMenu() { navOverlay.classList.remove("open"); navMenu.classList.remove("open"); }
menuBtn.onclick = () => navMenu.classList.contains("open") ? closeMenu() : openMenu();
navOverlay.onclick = closeMenu;

document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
  btn.onclick = () => {
    switchTab(btn.dataset.tab);
    closeMenu();
  };
});

function switchTab(tabName) {
  currentTab = tabName;
  Object.entries(tabs).forEach(([name, el]) => el.classList.toggle("active", name === tabName));
  document.querySelectorAll(".nav-item[data-tab]").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.tab === tabName)
  );

  if (tabName === "globe") {
    if (!globe) initGlobe();
    else { globe.width($("globe-container").clientWidth).height($("globe-container").clientHeight); }
  }
  if (tabName === "map2d") {
    if (!leafletMap) setTimeout(initLeaflet, 100);
    else setTimeout(() => leafletMap.invalidateSize(), 100);
  }
  if (tabName === "list") renderCountriesList();
  if (tabName === "admin" && currentUser?.role === "admin") loadAdmin();
}


// ═══════════════════════════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════════════════════════
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function loadTrips() {
  try {
    const res = await fetch(API.trips, { headers: authHeaders() });
    trips = await res.json();
    updateStats();
  } catch { trips = []; }
}

function updateStats() {
  const countries = trips.length;
  const cities = trips.reduce((s, t) => s + (t.cities ? t.cities.split(",").filter(c => c.trim()).length : 0), 0);
  $("statsCountries").textContent = `${countries} ${pl(countries, "страна", "страны", "стран")}`;
  $("statsCities").textContent = `${cities} ${pl(cities, "город", "города", "городов")}`;
}

function pl(n, o, f, m) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return m;
  if (m10 === 1) return o;
  if (m10 >= 2 && m10 <= 4) return f;
  return m;
}

async function loadApp() {
  const geoRes = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
  const topoData = await geoRes.json();
  const obj = topoData.objects[Object.keys(topoData.objects)[0]];
  geoData = topojson.feature(topoData, obj).features;
  await loadTrips();
  initGlobe();
  setTimeout(() => hintBadge.classList.add("hidden"), 5000);
}


// ═══════════════════════════════════════════════════════════════════
//  3D GLOBE (markers only, no polygons)
// ═══════════════════════════════════════════════════════════════════
function initGlobe() {
  const container = $("globe-container");
  container.innerHTML = "";
  const markers = trips.map(t => ({ lat: t.lat, lng: t.lng, label: `${t.flag_emoji} ${t.country_name}`, tripId: t.id }));

  globe = Globe()
    .globeImageUrl("https://unpkg.com/three-globe@2.33.0/example/img/earth-blue-marble.jpg")
    .bumpImageUrl("https://unpkg.com/three-globe@2.33.0/example/img/earth-topology.png")
    .backgroundImageUrl("https://unpkg.com/three-globe@2.33.0/example/img/night-sky.png")
    .showAtmosphere(true)
    .atmosphereColor("#4da6ff")
    .atmosphereAltitude(0.2)
    .htmlElementsData(markers)
    .htmlLat(d => d.lat)
    .htmlLng(d => d.lng)
    .htmlElement(d => {
      const el = document.createElement("div");
      el.innerHTML = `<div style="display:flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);border-radius:100px;color:#fff;font-size:12px;font-weight:600;font-family:-apple-system,sans-serif;cursor:pointer;white-space:nowrap;pointer-events:auto;transition:transform .2s,background .2s;border:1px solid rgba(255,255,255,0.15);" onmouseover="this.style.transform='scale(1.1)';this.style.background='rgba(0,122,255,0.7)'" onmouseout="this.style.transform='scale(1)';this.style.background='rgba(0,0,0,0.55)'"><span style="font-size:15px">${d.label.split(" ")[0]}</span><span>${d.label.split(" ").slice(1).join(" ")}</span></div>`;
      el.onclick = () => openTripSheet(d.tripId);
      return el;
    })
    .htmlAltitude(0.02)
    .width(container.clientWidth)
    .height(container.clientHeight)
    (container);

  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.4;
  globe.controls().enableDamping = true;
  globe.pointOfView({ lat: 45, lng: 30, altitude: 2.2 }, 0);

  window.addEventListener("resize", () => {
    if (globe && currentTab === "globe") globe.width(container.clientWidth).height(container.clientHeight);
  });
}

function refreshGlobe() {
  if (!globe) return;
  const markers = trips.map(t => ({ lat: t.lat, lng: t.lng, label: `${t.flag_emoji} ${t.country_name}`, tripId: t.id }));
  globe.htmlElementsData(markers);
}


// ═══════════════════════════════════════════════════════════════════
//  2D MAP (Leaflet + polygons + layer toggle)
// ═══════════════════════════════════════════════════════════════════
const TILE_URLS = {
  grayscale: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

function initLeaflet() {
  const container = $("map-container");
  leafletMap = L.map(container, { zoomControl: false, attributionControl: false }).setView([30, 20], 2);

  leafletLayers.grayscale = L.tileLayer(TILE_URLS.grayscale, { maxZoom: 18 });
  leafletLayers.satellite = L.tileLayer(TILE_URLS.satellite, { maxZoom: 18 });
  leafletLayers[currentMapStyle].addTo(leafletMap);

  L.control.zoom({ position: "bottomleft" }).addTo(leafletMap);
  drawCountryPolygons();
  addMapMarkers();

  // Layer toggle buttons
  document.querySelectorAll(".map-toggle-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".map-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const style = btn.dataset.style;
      if (style !== currentMapStyle) {
        leafletMap.removeLayer(leafletLayers[currentMapStyle]);
        leafletLayers[style].addTo(leafletMap);
        currentMapStyle = style;
      }
    };
  });
}

const NUMERIC_TO_ISO = {
  "004":"AF","008":"AL","012":"DZ","020":"AD","024":"AO","028":"AG","032":"AR","051":"AM",
  "036":"AU","040":"AT","031":"AZ","044":"BS","048":"BH","050":"BD","112":"BY","056":"BE",
  "084":"BZ","204":"BJ","064":"BT","068":"BO","070":"BA","072":"BW","076":"BR","096":"BN",
  "100":"BG","116":"KH","120":"CM","124":"CA","152":"CL","156":"CN","170":"CO","188":"CR",
  "191":"HR","192":"CU","196":"CY","203":"CZ","208":"DK","214":"DO","218":"EC","818":"EG",
  "233":"EE","231":"ET","246":"FI","250":"FR","268":"GE","276":"DE","300":"GR","320":"GT",
  "340":"HN","348":"HU","352":"IS","356":"IN","360":"ID","364":"IR","368":"IQ","372":"IE",
  "376":"IL","380":"IT","388":"JM","392":"JP","400":"JO","398":"KZ","404":"KE","410":"KR",
  "414":"KW","417":"KG","428":"LV","422":"LB","440":"LT","442":"LU","450":"MG","458":"MY",
  "462":"MV","470":"MT","484":"MX","498":"MD","492":"MC","496":"MN","499":"ME","504":"MA",
  "508":"MZ","104":"MM","516":"NA","524":"NP","528":"NL","554":"NZ","558":"NI","566":"NG",
  "578":"NO","512":"OM","586":"PK","591":"PA","600":"PY","604":"PE","608":"PH","616":"PL",
  "620":"PT","634":"QA","642":"RO","643":"RU","682":"SA","688":"RS","702":"SG","703":"SK",
  "705":"SI","710":"ZA","724":"ES","144":"LK","752":"SE","756":"CH","158":"TW","762":"TJ",
  "834":"TZ","764":"TH","788":"TN","792":"TR","795":"TM","804":"UA","784":"AE","826":"GB",
  "840":"US","858":"UY","860":"UZ","862":"VE","704":"VN",
};

let polygonLayer = null;

function drawCountryPolygons() {
  if (!geoData || !leafletMap) return;
  const visitedCodes = new Set(trips.map(t => t.country_code));

  if (polygonLayer) leafletMap.removeLayer(polygonLayer);

  // Convert TopoJSON features to GeoJSON FeatureCollection for Leaflet
  const features = geoData.filter(f => {
    const iso = NUMERIC_TO_ISO[String(f.id)] || "";
    return visitedCodes.has(iso);
  }).map(f => ({
    type: "Feature",
    properties: { ...f.properties, iso: NUMERIC_TO_ISO[String(f.id)] || "" },
    geometry: f.geometry,
  }));

  if (!features.length) return;

  polygonLayer = L.geoJSON({ type: "FeatureCollection", features }, {
    style: () => ({
      fillColor: "#007AFF",
      fillOpacity: 0.25,
      color: "#007AFF",
      weight: 1.5,
      opacity: 0.5,
    }),
    onEachFeature: (feature, layer) => {
      const trip = trips.find(t => t.country_code === feature.properties.iso);
      if (trip) {
        layer.bindTooltip(`${trip.flag_emoji} ${trip.country_name}`, {
          className: "leaflet-glass-tooltip",
          direction: "top",
        });
        layer.on("click", () => openTripSheet(trip.id));
      }
    },
  }).addTo(leafletMap);
}

let markerLayer = null;

function addMapMarkers() {
  if (!leafletMap) return;
  if (markerLayer) leafletMap.removeLayer(markerLayer);

  markerLayer = L.layerGroup();
  trips.forEach(t => {
    const icon = L.divIcon({
      className: "map-pin",
      html: `<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);border-radius:100px;color:#fff;font-size:11px;font-weight:600;font-family:-apple-system,sans-serif;white-space:nowrap;border:1px solid rgba(255,255,255,0.15)"><span style="font-size:14px">${t.flag_emoji}</span>${t.country_name}</div>`,
      iconSize: null,
      iconAnchor: [0, 0],
    });
    L.marker([t.lat, t.lng], { icon }).on("click", () => openTripSheet(t.id)).addTo(markerLayer);
  });
  markerLayer.addTo(leafletMap);
}

function refreshMap() {
  drawCountryPolygons();
  addMapMarkers();
}


// ═══════════════════════════════════════════════════════════════════
//  COUNTRIES LIST (with search)
// ═══════════════════════════════════════════════════════════════════
function renderCountriesList(filter = "") {
  const list = $("countriesList");
  const q = filter.toLowerCase();
  const filtered = trips.filter(t =>
    !q || t.country_name.toLowerCase().includes(q) || t.cities.toLowerCase().includes(q)
  );

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 15s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg><p>${q ? "Ничего не найдено" : "Добавьте свою первую поездку"}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const stars = Array.from({ length: 5 }, (_, i) =>
      `<span class="star${i < t.rating ? "" : " empty"}" style="font-size:14px">★</span>`
    ).join("");
    const cities = t.cities ? t.cities.split(",").map(c => c.trim()).filter(Boolean).slice(0, 3).join(", ") : "";
    return `
      <div class="country-card fade-in-up" onclick="openTripSheet(${t.id})">
        <span class="card-flag">${t.flag_emoji}</span>
        <div class="card-body">
          <div class="card-name">${t.country_name}</div>
          <div class="card-sub">${cities || formatDate(t.date_from) + " — " + formatDate(t.date_to)}</div>
          <div class="card-stars stars">${stars}</div>
        </div>
      </div>
    `;
  }).join("");
}

$("searchInput").addEventListener("input", e => renderCountriesList(e.target.value));


// ═══════════════════════════════════════════════════════════════════
//  ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════
async function loadAdmin() {
  try {
    const [statsRes, usersRes] = await Promise.all([
      fetch(API.adminStats, { headers: authHeaders() }),
      fetch(API.adminUsers, { headers: authHeaders() }),
    ]);
    const stats = await statsRes.json();
    const users = await usersRes.json();

    $("adminStats").innerHTML = `
      <span class="stat-badge">${stats.total_users} пользователей</span>
      <span class="stat-badge">${stats.total_trips} поездок</span>
    `;

    $("adminUsersList").innerHTML = users.map(u => `
      <div class="user-card">
        <div class="user-info">
          <div class="user-avatar">${u.username[0].toUpperCase()}</div>
          <div class="user-meta">
            <h4>${u.username}</h4>
            <span class="user-role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role}</span>
          </div>
        </div>
        ${u.role !== "admin" ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Удалить</button>` : ""}
      </div>
    `).join("");
  } catch { }
}

async function deleteUser(userId) {
  if (!confirm("Удалить пользователя и все его данные?")) return;
  await fetch(`${API.adminUsers}/${userId}`, { method: "DELETE", headers: authHeaders() });
  loadAdmin();
}


// ═══════════════════════════════════════════════════════════════════
//  TRIP DETAIL SHEET
// ═══════════════════════════════════════════════════════════════════
function openTripSheet(tripId) {
  const trip = trips.find(t => t.id === tripId);
  if (!trip) return;

  if (globe && currentTab === "globe") {
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: trip.lat, lng: trip.lng, altitude: 1.8 }, 1000);
  }
  if (leafletMap && currentTab === "map2d") {
    leafletMap.flyTo([trip.lat, trip.lng], 5, { duration: 1 });
  }

  sheetTitle.innerHTML = `${trip.flag_emoji} ${trip.country_name}`;
  const stars = Array.from({ length: 5 }, (_, i) => `<span class="star${i < trip.rating ? "" : " empty"}">★</span>`).join("");
  const citiesArr = trip.cities ? trip.cities.split(",").map(s => s.trim()).filter(Boolean) : [];
  const chips = citiesArr.length
    ? `<div class="chips">${citiesArr.map(c => `<span class="chip">📍 ${c}</span>`).join("")}</div>`
    : `<span style="color:var(--text3);font-size:14px">Не указаны</span>`;

  sheetBody.innerHTML = `
    <div class="info-card fade-in-up">
      <div class="info-row"><span class="label">Даты</span><span class="value">${formatDate(trip.date_from)} — ${formatDate(trip.date_to)}</span></div>
      <div class="info-row"><span class="label">Рейтинг</span><span class="value"><div class="stars">${stars}</div></span></div>
    </div>
    <div class="section-title">Города</div>
    <div class="info-card fade-in-up" style="animation-delay:.05s">${chips}</div>
    ${trip.description ? `<div class="section-title">О поездке</div><div class="info-card fade-in-up" style="animation-delay:.1s"><div class="description-text">${esc(trip.description)}</div></div>` : ""}
    <div class="section-title">Фотографии</div>
    <div class="info-card fade-in-up" style="animation-delay:.15s"><div id="photoContainer"><div class="photos-loading"><div class="spinner"></div></div></div></div>
    <div style="display:flex;gap:8px;margin-top:20px">
      <button class="btn btn-secondary btn-sm" onclick="openEditForm(${trip.id})">Редактировать</button>
      <button class="btn btn-danger btn-sm" onclick="deleteTrip(${trip.id})">Удалить</button>
    </div>
  `;

  sheetOverlay.classList.add("open");
  tripSheet.classList.add("open");
  loadPhotos(trip.id);
}

function closeTripSheet() {
  sheetOverlay.classList.remove("open");
  tripSheet.classList.remove("open");
  if (globe) globe.controls().autoRotate = true;
}

$("btnCloseSheet").onclick = closeTripSheet;
sheetOverlay.onclick = closeTripSheet;


// ─── Photos ──────────────────────────────────────────────────────
async function loadPhotos(tripId) {
  const container = $("photoContainer");
  try {
    const res = await fetch(`${API.trips}/${tripId}/photos`, { headers: authHeaders() });
    const photos = await res.json();
    if (!photos.length) { container.innerHTML = `<div class="photos-placeholder">Фотографии пока не добавлены</div>`; return; }
    container.innerHTML = `<div class="photo-grid">${photos.map(p => `<img src="${p.preview}" alt="${p.name}" loading="lazy" onclick="openLightbox('${p.full}')" />`).join("")}</div>`;
  } catch { container.innerHTML = `<div class="photos-placeholder">Не удалось загрузить фото</div>`; }
}

function openLightbox(url) { lightboxImg.src = url; lightbox.classList.add("open"); }
lightbox.onclick = () => { lightbox.classList.remove("open"); lightboxImg.src = ""; };


// ═══════════════════════════════════════════════════════════════════
//  TRIP FORM (Add / Edit)
// ═══════════════════════════════════════════════════════════════════
fab.onclick = () => { openTripForm(null); };

function openTripForm(trip) {
  const isEdit = !!trip;
  formSheetTitle.textContent = isEdit ? "Редактировать" : "Добавить поездку";

  const opts = COUNTRIES.map(c =>
    `<option value="${c.code}" ${trip?.country_code === c.code ? "selected" : ""}>${c.flag} ${c.name}</option>`
  ).join("");

  formSheetBody.innerHTML = `
    <form class="trip-form" id="tripForm">
      <div class="form-group"><label>Страна</label><select class="form-input" id="fCountry" required ${isEdit ? "disabled" : ""}><option value="">Выберите...</option>${opts}</select></div>
      <div class="form-row">
        <div class="form-group"><label>Дата начала</label><input type="date" class="form-input" id="fDateFrom" value="${trip?.date_from || ""}" required /></div>
        <div class="form-group"><label>Дата окончания</label><input type="date" class="form-input" id="fDateTo" value="${trip?.date_to || ""}" required /></div>
      </div>
      <div class="form-group"><label>Города (через запятую)</label><input type="text" class="form-input" id="fCities" value="${trip?.cities || ""}" placeholder="Токио, Киото, Осака" /></div>
      <div class="form-group"><label>Описание</label><textarea class="form-input" id="fDesc" placeholder="Расскажите о поездке...">${trip?.description || ""}</textarea></div>
      <div class="form-group"><label>Рейтинг</label><div class="rating-input" id="ratingInput">${[1,2,3,4,5].map(i => `<button type="button" class="star-btn ${i <= (trip?.rating || 5) ? "active" : ""}" data-v="${i}">★</button>`).join("")}</div></div>
      <div class="form-group"><label>Яндекс Диск</label><input type="text" class="form-input" id="fYadisk" value="${trip?.yadisk_path || ""}" placeholder="/Photos/Japan или публичная ссылка" /></div>
      <div class="form-error" id="fError"></div>
      <div style="display:flex;gap:8px;margin-top:20px"><button type="submit" class="btn btn-primary" style="flex:1">${isEdit ? "Сохранить" : "Добавить"}</button><button type="button" class="btn btn-secondary" onclick="closeFormSheet()">Отмена</button></div>
    </form>
  `;

  let rating = trip?.rating || 5;
  const stars = document.querySelectorAll("#ratingInput .star-btn");
  stars.forEach(b => b.onclick = () => { rating = +b.dataset.v; stars.forEach((s, i) => s.classList.toggle("active", i < rating)); });

  $("tripForm").onsubmit = async e => {
    e.preventDefault();
    const err = $("fError");
    err.textContent = "";
    const code = isEdit ? trip.country_code : $("fCountry").value;
    const country = getCountryByCode(code);
    if (!country) { err.textContent = "Выберите страну"; return; }

    const body = {
      country_name: country.name, country_code: country.code, flag_emoji: country.flag,
      date_from: $("fDateFrom").value, date_to: $("fDateTo").value,
      cities: $("fCities").value, description: $("fDesc").value,
      rating, lat: country.lat, lng: country.lng, yadisk_path: $("fYadisk").value,
    };

    const url = isEdit ? `${API.trips}/${trip.id}` : API.trips;
    const method = isEdit ? "PUT" : "POST";
    try {
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) { err.textContent = (await res.json()).detail || "Ошибка"; return; }
      closeFormSheet(); closeTripSheet();
      await loadTrips(); refreshGlobe(); refreshMap();
      if (currentTab === "list") renderCountriesList();
    } catch { err.textContent = "Ошибка сети"; }
  };

  formOverlay.classList.add("open");
  formSheet.classList.add("open");
}

function openEditForm(tripId) { openTripForm(trips.find(t => t.id === tripId)); }

function closeFormSheet() { formOverlay.classList.remove("open"); formSheet.classList.remove("open"); }
$("btnCloseForm").onclick = closeFormSheet;
formOverlay.onclick = closeFormSheet;


// ─── Delete Trip ─────────────────────────────────────────────────
async function deleteTrip(tripId) {
  if (!confirm("Удалить эту поездку?")) return;
  await fetch(`${API.trips}/${tripId}`, { method: "DELETE", headers: authHeaders() });
  closeTripSheet();
  await loadTrips(); refreshGlobe(); refreshMap();
  if (currentTab === "list") renderCountriesList();
}


// ═══════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════
function formatDate(s) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  const mo = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  return `${+d} ${mo[+m - 1]} ${y}`;
}

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }


// ═══════════════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════════════
const topojsonScript = document.createElement("script");
topojsonScript.src = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";
topojsonScript.onload = () => {
  // App starts from auth screen — no init until login
};
document.head.appendChild(topojsonScript);
