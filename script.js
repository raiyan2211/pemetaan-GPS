// ==========================================
// 1. KONFIGURASI FIREBASE REALTIME DATABASE
// ==========================================
// Tempelkan firebaseConfig milik Anda dari Firebase Console di sini
// ==========================================
// 1. KONFIGURASI FIREBASE REALTIME DATABASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyA2Q1Yb1neORAs_U-48sbZXnWIJC9BZi5w",
  authDomain: "pemetaan-realtime.firebaseapp.com",
  databaseURL: "https://pemetaan-realtime-default-rtdb.firebaseio.com", // Catatan: Sesuaikan URL jika lokasi server Anda berbeda di console
  projectId: "pemetaan-realtime",
  storageBucket: "pemetaan-realtime.firebasestorage.app",
  messagingSenderId: "885648202378",
  appId: "1:885648202378:web:db1ea92e6d98b5ff332b73",
  measurementId: "G-2Q1NF14XTE"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const pointsRef = db.ref('polygon_points');

// Global State Variables
let points = [];
let pointKeys = []; // Menyimpan key ID unik dari Firebase
let markers = [];
let polygonLayer = null;
let map = null;

// Initialize Map
window.onload = function() {
  map = L.map('map').setView([-7.2575, 112.7521], 16);

  // Satelit Google Hybrid Layer
  L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Satellite Maps'
  }).addTo(map);

  // Klik manual pada peta
  map.on('click', function(e) {
    addPointToFirebase(e.latlng.lat, e.latlng.lng);
  });

  // Listener Real-time Database
  listenToDatabaseChanges();
};

// ==========================================
// 2. SINKRONISASI DATABASE REALTIME
// ==========================================

function listenToDatabaseChanges() {
  pointsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    clearMapVisuals();

    points = [];
    pointKeys = [];

    if (data) {
      Object.keys(data).forEach((key) => {
        const pt = data[key];
        const coord = [pt.lat, pt.lng];
        points.push(coord);
        pointKeys.push(key);

        // Marker Leaflet
        const marker = L.marker([pt.lat, pt.lng]).addTo(map);
        marker.bindPopup(`
          <b>Titik ${points.length}</b><br>
          Lat: ${pt.lat}<br>
          Lng: ${pt.lng}<br>
          <a class="earth-popup-btn" href="https://earth.google.com/web/@${pt.lat},${pt.lng},100a,500d,35y,0h,45t,0r" target="_blank">
            <i class="fa-solid fa-earth-americas"></i> Lihat Rumah 3D
          </a>
        `);
        markers.push(marker);
      });

      // Fokuskan peta ke titik pertama jika baru dimuat
      if (points.length === 1) {
        map.setView([points[0][0], points[0][1]], 19);
      }
    }

    updatePolygon();
    renderSidebarPoints();
  });
}

// Kirim Titik ke Firebase
function addPointToFirebase(lat, lng) {
  const cleanLat = parseFloat(lat.toFixed(6));
  const cleanLng = parseFloat(lng.toFixed(6));

  pointsRef.push({
    lat: cleanLat,
    lng: cleanLng,
    timestamp: Date.now()
  });
}

// Hapus Visualisasi Peta
function clearMapVisuals() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  if (polygonLayer) {
    map.removeLayer(polygonLayer);
  }
}

// ==========================================
// 3. LOGIKA KALKULASI & ANTARMUKA
// ==========================================

function updatePolygon() {
  if (polygonLayer) map.removeLayer(polygonLayer);

  if (points.length >= 3) {
    const turfCoords = points.map(p => [p[1], p[0]]);
    turfCoords.push([points[0][1], points[0][0]]);

    const polygonGeoJSON = turf.polygon([turfCoords]);

    // Kalkulasi Luas & Keliling
    const areaSqM = turf.area(polygonGeoJSON);
    const areaHa = areaSqM / 10000;
    const perimeterM = turf.length(polygonGeoJSON, { units: 'meters' });

    document.getElementById('area-val').innerText = Math.round(areaSqM).toLocaleString('id-ID');
    document.getElementById('area-ha-val').innerText = areaHa.toFixed(3);
    document.getElementById('perimeter-val').innerText = Math.round(perimeterM).toLocaleString('id-ID') + ' m';

    // Render Poligon Biru
    const leafletCoords = points.map(p => [p[0], p[1]]);
    polygonLayer = L.polygon(leafletCoords, {
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.4,
      weight: 3
    }).addTo(map);
  } else {
    document.getElementById('area-val').innerText = '0';
    document.getElementById('area-ha-val').innerText = '0';
    document.getElementById('perimeter-val').innerText = '0 m';
  }
}

function renderSidebarPoints() {
  const container = document.getElementById('point-list-container');

  if (points.length === 0) {
    container.innerHTML = `<div id="empty-state" style="padding: 15px; text-align: center; color: #94a3b8; font-size: 0.8rem;">Belum ada titik koordinat</div>`;
    return;
  }

  container.innerHTML = '';

  points.forEach((pt, idx) => {
    const item = document.createElement('div');
    item.className = 'point-item';
    item.innerHTML = `
      <span><b>T${idx + 1}:</b> ${pt[0]}, ${pt[1]}</span>
      <button class="btn btn-danger" style="padding: 2px 5px; font-size: 0.65rem;" onclick="removeSinglePoint('${pointKeys[idx]}')">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    container.appendChild(item);
  });
}

// Hapus Satu Titik Tertentu di Firebase
function removeSinglePoint(key) {
  if (key) {
    db.ref(`polygon_points/${key}`).remove();
  }
}

// Hapus Semua Titik di Firebase
function clearAllPoints() {
  if (confirm("Apakah Anda yakin ingin menghapus seluruh titik dari database?")) {
    pointsRef.remove();
  }
}

// Ambil GPS dari Sensor HP
function getGPSLocation() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setView([lat, lng], 19);
        addPointToFirebase(lat, lng);
      },
      (error) => {
        alert("Gagal mengambil posisi GPS. Pastikan izin lokasi (GPS) sudah diizinkan di browser HP.");
      },
      { enableHighAccuracy: true }
    );
  } else {
    alert("Perangkat Anda tidak mendukung fitur Geolocation.");
  }
}

// Cari Alamat/Lokasi
function searchAddress() {
  const query = document.getElementById('address-input').value;
  if (!query) return;

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        map.setView([lat, lon], 19);
      } else {
        alert("Alamat/Rumah tidak ditemukan.");
      }
    })
    .catch(() => alert("Terjadi kesalahan saat mencari lokasi."));
}

// Buka Google Earth 3D
function openInGoogleEarth() {
  if (points.length === 0) {
    alert("Silakan buat/tentukan minimal 1 titik lokasi terlebih dahulu!");
    return;
  }

  let sumLat = 0, sumLng = 0;
  points.forEach(p => { sumLat += p[0]; sumLng += p[1]; });
  const centerLat = (sumLat / points.length).toFixed(6);
  const centerLng = (sumLng / points.length).toFixed(6);

  const earthUrl = `https://earth.google.com/web/@${centerLat},${centerLng},100a,150d,35y,0h,45t,0r`;
  window.open(earthUrl, '_blank');
}

// Export File KML
function exportKML() {
  if (points.length < 3) {
    alert("Minimal 3 titik diperlukan untuk membuat Poligon KML.");
    return;
  }

  let kmlCoords = points.map(p => `${p[1]},${p[0]},0`).join(' ');
  kmlCoords += ` ${points[0][1]},${points[0][0]},0`;

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Pemetaan Lahan Poligon</name>
    <Style id="polyStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>7f0000ff</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>Hasil Pemetaan Lahan</name>
      <styleUrl>#polyStyle</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${kmlCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;

  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pemetaan-lahan.kml';
  a.click();
  URL.revokeObjectURL(url);
}