const CACHE_NAME = 'gecko-bm-v3.3.0';
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
    './images/morphs/aberrant.png',
    './images/morphs/akoya.png',
    './images/morphs/bellAlbino.png',
    './images/morphs/blackNight.png',
    './images/morphs/blackOlive.png',
    './images/morphs/blackPearl.png',
    './images/morphs/blizzard.png',
    './images/morphs/boldStripe.png',
    './images/morphs/carrotTail_v2.png',
    './images/morphs/charcoal.png',
    './images/morphs/cipher.png',
    './images/morphs/clown.png',
    './images/morphs/darkKnight.png',
    './images/morphs/eclipse.png',
    './images/morphs/emerine.png',
    './images/morphs/enigma.png',
    './images/morphs/fire.png',
    './images/morphs/gMackSnow.png',
    './images/morphs/gemSnow.png',
    './images/morphs/ghost.png',
    './images/morphs/giant.png',
    './images/morphs/highYellow.png',
    './images/morphs/hypo.png',
    './images/morphs/inferno.png',
    './images/morphs/jokerProject.png',
    './images/morphs/jungle.png',
    './images/morphs/lavender.png',
    './images/morphs/lemonFrost.png',
    './images/morphs/mackSnow.png',
    './images/morphs/mandarin.png',
    './images/morphs/marbleEye.png',
    './images/morphs/melanistic.png',
    './images/morphs/midnightBlizzard.png',
    './images/morphs/murphyPatternless.png',
    './images/morphs/ndbe.png',
    './images/morphs/pandaProject.png',
    './images/morphs/paradox.png',
    './images/morphs/purpleHead.png',
    './images/morphs/rainwaterAlbino.png',
    './images/morphs/redStripe.png',
    './images/morphs/reverseStripe.png',
    './images/morphs/stripe.png',
    './images/morphs/superHypo.png',
    './images/morphs/tangerine.png',
    './images/morphs/tremperAlbino.png',
    './images/morphs/tugSnow.png',
    './images/morphs/werewolf.png',
    './images/morphs/whiteFace.png',
    './images/morphs/whiteYellow.png'
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

// skipWaitingの強制実行
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
