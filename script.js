(() => {
  'use strict';

  const video1 = document.getElementById('videoBackground1');
  const video2 = document.getElementById('videoBackground2');
  const menu = document.getElementById('menu');
  const wallpaperGrid = document.getElementById('wallpaperGrid');
  const btnAdd = document.getElementById('btnAddVideo');
  const inputVideo = document.getElementById('videoInput');

  // Lista dos vídeos locais
  const videoFiles = [
    'video2', 'video3', 'video4', 'video5', 'video6', 'video7',
    'video8', 'video9', 'video10', 'video11', 'video12', 'video13',
    'video14', 'video15', 'video16', 'video17', 'video18'
  ];

  let monitor2Window = null;

  // Gerador em fila de frames reais do vídeo via Canvas (armazenado em cache IndexedDB / Memory)
  const thumbCache = {};
  const queue = [];
  let isExtracting = false;

  // Inicializa IndexedDB para carregar as thumbs reais instantaneamente nas próximas aberturas
  let dbPromise = new Promise((resolve) => {
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

  // Extração real sequencial (1 por 1) para não engasgar CPU/rede
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
      // Captura no segundo 1 para evitar tela preta de fade-in
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
    // Coloca na fila de extração em segundo plano
    queue.push({ url: videoUrl, key, imgEl });
    processQueue();
  }

  // Reprodução nos monitores
  function playOnMonitor(videoUrl, monitor = 1) {
    if (monitor === 1) {
      video1.src = videoUrl;
      video1.classList.add('active');
      video1.play().catch(() => {});
    } else {
      // Monitor 2: abre ou comanda popup na segunda tela
      if (!monitor2Window || monitor2Window.closed) {
        const left = window.screen.width || 1920;
        monitor2Window = window.open('', 'WallpaperMonitor2', `left=${left},top=0,width=1920,height=1080,fullscreen=yes,menubar=no,toolbar=no,location=no,status=no`);
        if (monitor2Window) {
          monitor2Window.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Monitor 2</title>
              <style>
                * { margin:0; padding:0; overflow:hidden; background:#000; }
                video { width:100vw; height:100vh; object-fit:cover; }
              </style>
            </head>
            <body>
              <video id="v2" autoplay loop muted playsinline src="${videoUrl}"></video>
            </body>
            </html>
          `);
          monitor2Window.document.close();
        } else {
          // Se bloqueado popups, toca no segundo elemento interno
          video2.src = videoUrl;
          video2.classList.add('active');
          video2.play().catch(() => {});
        }
      } else {
        const v2 = monitor2Window.document.getElementById('v2');
        if (v2) {
          v2.src = videoUrl;
          v2.play().catch(() => {});
        }
      }
    }

    // Oculta completamente o menu sem deixar NENHUM hub ou botão
    menu.classList.add('hidden');
  }

  // Montagem da grid
  function buildGrid() {
    videoFiles.forEach((name) => {
      const url = `${name}.mp4`;
      const btn = document.createElement('button');
      btn.className = 'wallpaper-btn';

      const img = document.createElement('img');
      img.alt = '';
      btn.appendChild(img);

      loadRealThumbnail(url, name, img);

      // Clique esquerdo: Monitor 1
      btn.addEventListener('click', () => {
        playOnMonitor(url, 1);
      });

      // Clique direito: Monitor 2
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        playOnMonitor(url, 2);
      });

      wallpaperGrid.appendChild(btn);
    });
  }

  // Importar vídeo local
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

    btn.addEventListener('click', () => playOnMonitor(url, 1));
    btn.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      playOnMonitor(url, 2);
    });

    btnAdd.insertAdjacentElement('afterend', btn);
    playOnMonitor(url, 1);
    inputVideo.value = '';
  });

  // Atalho: tecla ESC para alternar o menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key.toLowerCase() === 'm') {
      e.preventDefault();
      menu.classList.toggle('hidden');
    }
  });

  // Iniciar
  buildGrid();
})();
