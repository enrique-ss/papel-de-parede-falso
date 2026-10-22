(() => {
  'use strict';

  // Detecta se esta tela é Monitor 1 ou Monitor 2 via parâmetro ?monitor=2 na URL
  const urlParams = new URLSearchParams(window.location.search);
  const monitorId = urlParams.get('monitor') === '2' ? 2 : 1;

  const video = document.getElementById('videoBackground1');
  const menu = document.getElementById('menu');
  const wallpaperGrid = document.getElementById('wallpaperGrid');
  const btnAdd = document.getElementById('btnAddVideo');
  const inputVideo = document.getElementById('videoInput');

  // Canal de sincronização entre janelas e monitores
  const channel = new BroadcastChannel('wallpaper_channel');

  const videoFiles = [
    'video2', 'video3', 'video4', 'video5', 'video6', 'video7',
    'video8', 'video9', 'video10', 'video11', 'video12', 'video13',
    'video14', 'video15', 'video16', 'video17', 'video18'
  ];

  // Cache IndexedDB para thumbnails reais dos vídeos
  const thumbCache = {};
  const queue = [];
  let isExtracting = false;

  const dbPromise = new Promise((resolve) => {
    const request = indexedDB.open('WallpaperThumbCache', 1);
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

  function processQueue() {
    if (isExtracting || queue.length === 0) return;
    isExtracting = true;
    const item = queue.shift();

    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.src = item.url;

    let timeout = setTimeout(() => {
      cleanup();
      processQueue();
    }, 4000);

    function cleanup() {
      clearTimeout(timeout);
      tempVideo.onloadeddata = null;
      tempVideo.onseeked = null;
      tempVideo.onerror = null;
      tempVideo.removeAttribute('src');
      tempVideo.load();
      isExtracting = false;
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
        saveCachedThumb(item.key, dataUrl);
        item.imgEl.src = dataUrl;
      } catch (e) {
        console.warn('Erro ao gerar frame:', e);
      }
      cleanup();
      processQueue();
    };

    tempVideo.onerror = () => {
      cleanup();
      processQueue();
    };
  }

  async function loadRealThumbnail(videoUrl, key, imgEl) {
    const cached = await getCachedThumb(key);
    if (cached) {
      imgEl.src = cached;
      return;
    }
    queue.push({ url: videoUrl, key, imgEl });
    processQueue();
  }

  // Reproduz o vídeo no monitor local
  function playLocalVideo(url) {
    if (!url) return;
    video.src = url;
    video.classList.add('active');
    video.play().catch(() => {});
    localStorage.setItem(`fw_monitor${monitorId}_url`, url);
    menu.classList.add('hidden');
  }

  // Comanda a outra tela
  function sendToRemoteMonitor(url) {
    const targetMonitor = monitorId === 1 ? 2 : 1;
    channel.postMessage({
      type: 'CHANGE_WALLPAPER',
      target: targetMonitor,
      url: url
    });
  }

  // Escuta mensagens do BroadcastChannel vindas da outra tela
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

      loadRealThumbnail(url, name, img);

      // Clique esquerdo: aplica NESTA tela
      btn.addEventListener('click', () => {
        playLocalVideo(url);
      });

      // Clique direito: aplica na OUTRA tela
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
    loadRealThumbnail(url, customKey, img);

    btn.addEventListener('click', () => playLocalVideo(url));
    btn.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      sendToRemoteMonitor(url);
    });

    btnAdd.insertAdjacentElement('afterend', btn);
    playLocalVideo(url);
    inputVideo.value = '';
  });

  // Atalho: tecla ESC ou M alterna a grade desta tela
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'm') {
      e.preventDefault();
      menu.classList.toggle('hidden');
    }
  });

  // Carrega vídeo padrão inicial ou último salvo
  const defaultVideo = monitorId === 1 ? 'video10.mp4' : 'video4.mp4';
  const savedVideo = localStorage.getItem(`fw_monitor${monitorId}_url`) || defaultVideo;
  video.src = savedVideo;
  video.classList.add('active');
  video.play().catch(() => {});

  buildGrid();
})();
