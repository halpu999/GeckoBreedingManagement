// Service Worker 無効化・即時解除
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(names.map((name) => caches.delete(name)));
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// フェッチはすべてネットワークへスルー
self.addEventListener('fetch', (e) => {
    return;
});
