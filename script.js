(() => {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const monitorId = urlParams.get('monitor') === '2' ? 2 : 1;

  const video = document.getElementById('videoBackground1');
  const menu = document.getElementById('menu');
  const wallpaperGrid = document.getElementById('wallpaperGrid');
  const btnAdd = document.getElementById('btnAddVideo');
  const inputVideo = document.getElementById('videoInput');

  const channel = new BroadcastChannel('wallpaper_channel');

  const videoFiles = [
    'video2', 'video3', 'video4', 'video5', 'video6', 'video7',
    'video8', 'video9', 'video10', 'video11', 'video12', 'video13',
    'video14', 'video15', 'video16', 'video17', 'video18'
  ];

  // 1. IndexedDB Cache Instantâneo
  const thumbCache = {};
  const dbPromise = new Promise((resolve) => {
    const request = indexedDB.open('WallpaperThumbCache_v2', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('thumbs')) {
        db.createObjectStore('thumbs');
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = () => resolve(null);
  });

  async function getCachedThumb(key) {
    if (thumbCache[key]) return thumbCache[key];
    const db = await dbPromise;
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction('thumbs', 'readonly');
      const store = tx.objectStore('thumbs');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result) thumbCache[key] = req.result;
        resolve(req.result);
      };
      req.onerror = () => resolve(null);
    });
  }

  async function saveCachedThumb(key, dataUrl) {
    thumbCache[key] = dataUrl;
    const db = await dbPromise;
    if (!db) return;
    const tx = db.transaction('thumbs', 'readwrite');
    const store = tx.objectStore('thumbs');
    store.put(dataUrl, key);
  }

  // Extração rápida em paralelo leve (pool de 3 vídeos simultâneos)
  const extractionPool = [];
  const MAX_CONCURRENT = 3;
  let activeWorkers = 0;

  function runExtractionPool() {
    while (activeWorkers < MAX_CONCURRENT && extractionPool.length > 0) {
      activeWorkers++;
      const item = extractionPool.shift();
      extractSingleThumbnail(item.url, item.key, item.imgEl).finally(() => {
        activeWorkers--;
        runExtractionPool();
      });
    }
  }

  function extractSingleThumbnail(videoUrl, key, imgEl) {
    return new Promise((resolve) => {
      const tempVideo = document.createElement('video');
      tempVideo.muted = true;
      tempVideo.playsInline = true;
      tempVideo.preload = 'auto';
      tempVideo.src = videoUrl;

      let timer = setTimeout(() => {
        cleanup();
        resolve();
      }, 4000);

      function cleanup() {
        clearTimeout(timer);
        tempVideo.onloadeddata = null;
        tempVideo.onseeked = null;
        tempVideo.onerror = null;
        tempVideo.removeAttribute('src');
        tempVideo.load();
      }

      tempVideo.onloadeddata = () => {
        tempVideo.currentTime = Math.min(1.0, (tempVideo.duration || 2) / 2);
      };

      tempVideo.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          saveCachedThumb(key, dataUrl);
          imgEl.src = dataUrl;
        } catch (e) {}
        cleanup();
        resolve();
      };

      tempVideo.onerror = () => {
        cleanup();
        resolve();
      };
    });
  }

  async function loadThumbnailFast(videoUrl, key, imgEl) {
    // 1. Tenta pegar do IndexedDB (imediatamente instantâneo a partir da 1ª vez)
    const cached = await getCachedThumb(key);
    if (cached) {
      imgEl.src = cached;
      return;
    }

    // 2. Tenta carregar thumbnail estática pré-existente
    const staticUrl = `thumbs/${key}.jpg`;
    const testImg = new Image();
    testImg.onload = () => {
      imgEl.src = staticUrl;
      saveCachedThumb(key, staticUrl);
    };
    testImg.onerror = () => {
      // 3. Adiciona ao pool de extração paralela
      extractionPool.push({ url: videoUrl, key, imgEl });
      runExtractionPool();
    };
    testImg.src = staticUrl;
  }

  function playLocalVideo(url) {
    if (!url) return;
    video.src = url;
    video.classList.add('active');
    video.play().catch(() => {});
    localStorage.setItem(`fw_monitor${monitorId}_url`, url);
    menu.classList.add('hidden');
  }

  function sendToRemoteMonitor(url) {
    const targetMonitor = monitorId === 1 ? 2 : 1;
    channel.postMessage({
      type: 'CHANGE_WALLPAPER',
      target: targetMonitor,
      url: url
    });
  }

  channel.onmessage = (event) => {
    if (event.data && event.data.type === 'CHANGE_WALLPAPER' && event.data.target === monitorId) {
      playLocalVideo(event.data.url);
    }
  };

  function buildGrid() {
    videoFiles.forEach((name) => {
      const url = `${name}.mp4`;
      const btn = document.createElement('button');
      btn.className = 'wallpaper-btn';

      const img = document.createElement('img');
      img.alt = '';
      btn.appendChild(img);

      loadThumbnailFast(url, name, img);

      btn.addEventListener('click', () => {
        playLocalVideo(url);
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        sendToRemoteMonitor(url);
      });

      wallpaperGrid.appendChild(btn);
    });
  }

  btnAdd.addEventListener('click', () => inputVideo.click());
  inputVideo.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);

    const btn = document.createElement('button');
    btn.className = 'wallpaper-btn';
    const img = document.createElement('img');
    btn.appendChild(img);

    const customKey = `local_${file.name}_${file.size}`;
    loadThumbnailFast(url, customKey, img);

    btn.addEventListener('click', () => playLocalVideo(url));
    btn.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      sendToRemoteMonitor(url);
    });

    btnAdd.insertAdjacentElement('afterend', btn);
    playLocalVideo(url);
    inputVideo.value = '';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'm') {
      e.preventDefault();
      menu.classList.toggle('hidden');
    }
  });

  const defaultVideo = monitorId === 1 ? 'video10.mp4' : 'video4.mp4';
  const savedVideo = localStorage.getItem(`fw_monitor${monitorId}_url`) || defaultVideo;
  video.src = savedVideo;
  video.classList.add('active');
  video.play().catch(() => {});

  buildGrid();
})();
