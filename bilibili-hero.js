(function () {
    /** 首页舰船宣传视频（本地静态资源，原 B 站 BV1MqVr6KESA / BV1uqVr6KETK） */
    const HERO_SOURCES = ['videos/hero-1.mp4', 'videos/hero-2.mp4'];
    const END_EPSILON = 0.25;
    const SWITCH_UNLOCK_MS = 5000;
    const END_WATCH_MS = 200;
    let started = false;

    function deferHeroStart() {
        if (started) return;
        started = true;
        initHeroVideos();
    }

    function scheduleHeroVideos() {
        if (started) return;
        const run = function () {
            deferHeroStart();
        };
        if (window.__ussPageReady) {
            run();
            return;
        }
        window.addEventListener(
            'uss:page-ready',
            function onReady() {
                window.removeEventListener('uss:page-ready', onReady);
                run();
            },
            { once: true }
        );
        setTimeout(function () {
            if (!started) run();
        }, 1500);
    }

    function setProgressScale(el, ratio) {
        if (!el) return;
        const clamped = Math.min(1, Math.max(0, ratio));
        el.style.transform = 'scaleX(' + clamped + ')';
    }

    function initHeroVideos() {
        const video1 = document.getElementById('myVideo1');
        const video2 = document.getElementById('myVideo2');
        const progressFill = document.querySelector('.progress-fill');
        const nextVideoBtn = document.querySelector('.next-video');

        if (!video1 || !video2 || !HERO_SOURCES.length) return;

        const videos = [video1, video2];
        const sources = HERO_SOURCES.slice(0, videos.length);
        let progressRaf = 0;
        let endWatchTimer = 0;
        let switchUnlockTimer = 0;

        videos.forEach(function (video, index) {
            video.removeAttribute('autoplay');
            video.muted = true;
            video.playsInline = true;
            video.loop = false;
            video.preload = 'metadata';
            video.dataset.heroSrc = sources[index] || sources[0];
        });

        let currentVideo = video1;
        let nextVideo = video2;
        let isSwitching = false;

        function stopProgressLoop() {
            if (progressRaf) {
                cancelAnimationFrame(progressRaf);
                progressRaf = 0;
            }
        }

        function stopEndWatch() {
            if (endWatchTimer) {
                clearInterval(endWatchTimer);
                endWatchTimer = 0;
            }
        }

        function startEndWatch() {
            stopEndWatch();
            endWatchTimer = setInterval(checkAdvance, END_WATCH_MS);
        }

        function lockSwitch() {
            isSwitching = true;
            if (switchUnlockTimer) clearTimeout(switchUnlockTimer);
            switchUnlockTimer = setTimeout(function () {
                isSwitching = false;
                switchUnlockTimer = 0;
            }, SWITCH_UNLOCK_MS);
        }

        function unlockSwitch() {
            if (switchUnlockTimer) {
                clearTimeout(switchUnlockTimer);
                switchUnlockTimer = 0;
            }
            isSwitching = false;
        }

        function shouldAdvanceVideo(video) {
            if (!video || !video.duration || !isFinite(video.duration)) return false;
            if (video.ended) return true;
            return video.currentTime >= Math.max(0, video.duration - END_EPSILON);
        }

        function checkAdvance() {
            if (!currentVideo || isSwitching) return;
            if (shouldAdvanceVideo(currentVideo)) {
                switchVideos();
            }
        }

        function tickProgress() {
            progressRaf = 0;
            if (!currentVideo || !progressFill) return;

            if (shouldAdvanceVideo(currentVideo)) {
                setProgressScale(progressFill, 1);
                switchVideos();
                return;
            }

            if (currentVideo.duration && isFinite(currentVideo.duration)) {
                setProgressScale(progressFill, currentVideo.currentTime / currentVideo.duration);
            }

            if (!currentVideo.paused) {
                progressRaf = requestAnimationFrame(tickProgress);
            }
        }

        function startProgressLoop() {
            stopProgressLoop();
            progressRaf = requestAnimationFrame(tickProgress);
        }

        function applyMediaUrl(video, mediaUrl, forceReload) {
            if (!forceReload && video.dataset.loadedSrc === mediaUrl) return;
            const source = video.querySelector('source');
            if (source) {
                source.src = mediaUrl;
            } else {
                video.src = mediaUrl;
            }
            video.dataset.loadedSrc = mediaUrl;
            if (video.readyState < 2) {
                try {
                    video.load();
                } catch (ignore) {}
            }
        }

        function attachSource(video, forceReload) {
            const src = video.dataset.heroSrc;
            if (!src) return Promise.resolve();

            const cache = window.UssHeroVideoCache;
            if (cache && typeof cache.resolveUrl === 'function') {
                return cache
                    .resolveUrl(src)
                    .then(function (mediaUrl) {
                        applyMediaUrl(video, mediaUrl, forceReload);
                    })
                    .catch(function () {
                        applyMediaUrl(video, src, forceReload);
                    });
            }

            applyMediaUrl(video, src, forceReload);
            return Promise.resolve();
        }

        function preloadNextVideoWhenIdle() {
            const run = function () {
                attachSource(nextVideo).catch(function () {});
            };
            if (window.requestIdleCallback) {
                window.requestIdleCallback(run, { timeout: 3000 });
            } else {
                setTimeout(run, 1500);
            }
        }

        function revealVideo(video) {
            if (!video) return;
            video.classList.add('active', 'is-ready');
        }

        function concealVideo(video) {
            if (!video) return;
            video.classList.remove('active', 'is-ready');
        }

        function waitForVideoReady(video) {
            return new Promise(function (resolve, reject) {
                if (video.readyState >= 2) {
                    resolve();
                    return;
                }
                function onReady() {
                    cleanup();
                    resolve();
                }
                function onError() {
                    cleanup();
                    reject(new Error('hero video load failed'));
                }
                function cleanup() {
                    video.removeEventListener('loadeddata', onReady);
                    video.removeEventListener('error', onError);
                }
                video.addEventListener('loadeddata', onReady, { once: true });
                video.addEventListener('error', onError, { once: true });
            });
        }

        function playVideo(video, fromStart) {
            if (fromStart) {
                video.dataset.heroSkipIntro = '1';
            }

            return attachSource(video)
                .then(function () {
                    return waitForVideoReady(video);
                })
                .then(function () {
                    if (fromStart) {
                        try {
                            video.currentTime = 0;
                        } catch (ignore) {}
                    }
                    setProgressScale(progressFill, 0);
                    return video.play();
                })
                .then(function () {
                    revealVideo(video);
                    startProgressLoop();
                });
        }

        function swapCurrentVideo() {
            stopProgressLoop();
            concealVideo(currentVideo);
            try {
                currentVideo.pause();
                currentVideo.currentTime = 0;
            } catch (ignore) {}

            const temp = currentVideo;
            currentVideo = nextVideo;
            nextVideo = temp;
        }

        function switchVideos() {
            if (isSwitching) return;
            lockSwitch();
            swapCurrentVideo();

            playVideo(currentVideo, true)
                .catch(function () {
                    delete currentVideo.dataset.loadedSrc;
                    return attachSource(currentVideo, true).then(function () {
                        return playVideo(currentVideo, true);
                    });
                })
                .catch(function () {
                    swapCurrentVideo();
                    delete currentVideo.dataset.loadedSrc;
                    return attachSource(currentVideo, true).then(function () {
                        return playVideo(currentVideo, true);
                    });
                })
                .catch(function () {
                    /* 仍失败则等 endWatch 再次尝试 */
                })
                .finally(function () {
                    unlockSwitch();
                });
        }

        function bindVideoEvents(video) {
            video.addEventListener('play', startProgressLoop);
            video.addEventListener('pause', function () {
                stopProgressLoop();
                if (video === currentVideo) checkAdvance();
            });
            video.addEventListener('ended', function () {
                if (video !== currentVideo || isSwitching) return;
                switchVideos();
            });
            video.addEventListener('timeupdate', function () {
                if (video !== currentVideo || isSwitching) return;
                if (shouldAdvanceVideo(video)) switchVideos();
            });
            video.addEventListener('error', function () {
                if (video !== currentVideo || isSwitching) return;
                switchVideos();
            });
            video.addEventListener('seeking', function () {
                if (video !== currentVideo || !progressFill || !video.duration) return;
                setProgressScale(progressFill, video.currentTime / video.duration);
            });
            video.addEventListener('loadedmetadata', function () {
                if (video !== currentVideo || video.duration <= 1) return;
                if (video.dataset.heroSkipIntro === '1') {
                    delete video.dataset.heroSkipIntro;
                    return;
                }
                try {
                    video.currentTime = Math.min(video.duration * 0.3, video.duration - 0.2);
                } catch (ignore) {}
            });
        }

        videos.forEach(bindVideoEvents);
        startEndWatch();
        preloadNextVideoWhenIdle();

        playVideo(currentVideo, false).catch(function () {
            playVideo(currentVideo, true).catch(function () {
                /* 首次播放失败时静默，用户可手动点下一段 */
            });
        });

        if (nextVideoBtn) {
            nextVideoBtn.addEventListener('click', switchVideos);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible' || isSwitching) return;
            if (currentVideo && shouldAdvanceVideo(currentVideo)) {
                switchVideos();
                return;
            }
            if (currentVideo && currentVideo.paused) {
                currentVideo.play().then(startProgressLoop).catch(function () {
                    switchVideos();
                });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleHeroVideos);
    } else {
        scheduleHeroVideos();
    }
})();
