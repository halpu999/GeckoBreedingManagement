const CACHE_NAME = 'gecko-bm-v3.1.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icon-512.png',
    './src/data/morphs.js',
    './src/data/events.js',
    './src/data/knowledge.js',
    './src/engine/genetics.js',
    './images/morphs/tremperAlbino.png',
    './images/morphs/bellAlbino.png',
    './images/morphs/rainwaterAlbino.png',
    './images/morphs/blizzard.png',
    './images/morphs/murphyPatternless.png',
    './images/morphs/eclipse.png',
    './images/morphs/mackSnow.png',
    './images/morphs/enigma.png',
    './images/morphs/whiteYellow.png',
    './images/morphs/giant.png',
    './images/morphs/darkKnight.png',
    './images/morphs/marbleEye.png'
];

// インストール時にアセットをキャッシュ
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] キャッシュを作成中...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// アクティベーション時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] 古いキャッシュを削除:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ネットワーク優先、失敗時にキャッシュから返す
self.addEventListener('fetch', (event) => {
    // Google Fonts などの外部リソースはネットワークのみ
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 正常なレスポンスをキャッシュに保存
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // オフライン時はキャッシュから返す
                return caches.match(event.request);
            })
    );
});
