(function () {
    /** 首页舰船宣传视频（本地 mp4） */
    const HERO_SOURCES = ['videos/hero-1.mp4', 'videos/hero-2.mp4'];
    const DARK_POSTER =
        'data:image/svg+xml,' +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#081625"/></svg>'
        );
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

    function ensureParking() {
        let parking = document.getElementById('heroVideoParking');
        if (!parking) {
            parking = document.createElement('div');
            parking.id = 'heroVideoParking';
            parking.setAttribute('aria-hidden', 'true');
            document.body.appendChild(parking);
        }
        return parking;
    }

    function createHeroVideo() {
        const video = document.createElement('video');
        video.id = 'myVideo1';
        video.className = 'video-player is-parked';
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'none';
        video.setAttribute('disablepictureinpicture', '');
        video.setAttribute('disableremoteplayback', '');
        video.setAttribute('poster', DARK_POSTER);
        return video;
    }

    function initHeroVideos() {
        const stage = document.getElementById('heroVideoStage');
        const progressFill = document.querySelector('.progress-fill');
        const nextVideoBtn = document.querySelector('.next-video');

        if (!stage || !HERO_SOURCES.length) return;

        const parking = ensureParking();
        const video = createHeroVideo();
        parking.appendChild(video);

        let sourceIndex = 0;
        let progressRaf = 0;
        let endWatchTimer = 0;
        let switchUnlockTimer = 0;
        let isSwitching = false;

        function currentSrc() {
            return HERO_SOURCES[sourceIndex] || HERO_SOURCES[0];
        }

        function assignHeroSrc(index) {
            sourceIndex = ((index % HERO_SOURCES.length) + HERO_SOURCES.length) % HERO_SOURCES.length;
            video.dataset.heroSrc = currentSrc();
        }

        assignHeroSrc(0);
        video.loop = false;
        video.preload = 'metadata';

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

        function shouldAdvanceVideo() {
            if (!video.duration || !isFinite(video.duration)) return false;
            if (video.ended) return true;
            return video.currentTime >= Math.max(0, video.duration - END_EPSILON);
        }

        function checkAdvance() {
            if (isSwitching) return;
            if (shouldAdvanceVideo()) switchVideos();
        }

        function tickProgress() {
            progressRaf = 0;
            if (!progressFill) return;

            if (shouldAdvanceVideo()) {
                setProgressScale(progressFill, 1);
                switchVideos();
                return;
            }

            if (video.duration && isFinite(video.duration)) {
                setProgressScale(progressFill, video.currentTime / video.duration);
            }

            if (!video.paused) {
                progressRaf = requestAnimationFrame(tickProgress);
            }
        }

        function startProgressLoop() {
            stopProgressLoop();
            progressRaf = requestAnimationFrame(tickProgress);
        }

        function applyMediaUrl(mediaUrl, forceReload) {
            if (!forceReload && video.dataset.loadedSrc === mediaUrl) return;
            video.removeAttribute('src');
            const source = video.querySelector('source');
            if (source) source.remove();
            video.src = mediaUrl;
            video.dataset.loadedSrc = mediaUrl;
            if (video.readyState < 2) {
                try {
                    video.load();
                } catch (ignore) {}
            }
        }

        function attachSource(forceReload) {
            const src = video.dataset.heroSrc;
            if (!src) return Promise.resolve();

            const cache = window.UssHeroVideoCache;
            if (cache && typeof cache.resolveUrl === 'function') {
                return cache
                    .resolveUrl(src)
                    .then(function (mediaUrl) {
                        applyMediaUrl(mediaUrl, forceReload);
                    })
                    .catch(function () {
                        applyMediaUrl(src, forceReload);
                    });
            }

            applyMediaUrl(src, forceReload);
            return Promise.resolve();
        }

        function preloadOtherWhenIdle() {
            const other = HERO_SOURCES[(sourceIndex + 1) % HERO_SOURCES.length];
            if (!other) return;
            const cache = window.UssHeroVideoCache;
            const run = function () {
                if (cache && typeof cache.warmup === 'function') {
                    cache.warmup([other]);
                } else if (cache && typeof cache.resolveUrl === 'function') {
                    cache.resolveUrl(other).catch(function () {});
                }
            };
            if (window.requestIdleCallback) {
                window.requestIdleCallback(run, { timeout: 4000 });
            } else {
                setTimeout(run, 2000);
            }
        }

        function markHeroLive() {
            document.documentElement.classList.remove('hero-video-pending');
            document.documentElement.classList.add('hero-video-live');
            stage.setAttribute('aria-hidden', 'false');
            const coverEl = document.getElementById('heroBootCover');
            if (coverEl) coverEl.setAttribute('aria-hidden', 'true');
        }

        function parkVideo() {
            const lot = ensureParking();
            video.classList.remove('active', 'is-ready');
            if (video.parentNode !== lot) {
                lot.appendChild(video);
            }
            video.classList.add('is-parked');
        }

        function waitForVideoReady() {
            return new Promise(function (resolve, reject) {
                function done() {
                    cleanup();
                    resolve();
                }
                function failed() {
                    cleanup();
                    reject(new Error('hero video load failed'));
                }
                function cleanup() {
                    video.removeEventListener('canplaythrough', done);
                    video.removeEventListener('error', failed);
                }
                if (video.readyState >= 4) {
                    resolve();
                    return;
                }
                video.addEventListener('canplaythrough', done, { once: true });
                video.addEventListener('error', failed, { once: true });
            });
        }

        function revealVideo() {
            stage.appendChild(video);
            video.classList.remove('is-parked');
            video.classList.add('active', 'is-ready');
            requestAnimationFrame(function () {
                markHeroLive();
            });
        }

        function playVideo(fromStart) {
            if (fromStart) {
                video.dataset.heroSkipIntro = '1';
            }

            parkVideo();

            return attachSource(fromStart)
                .then(function () {
                    return waitForVideoReady();
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
                    revealVideo();
                    startProgressLoop();
                });
        }

        function switchVideos() {
            if (isSwitching) return;
            lockSwitch();
            assignHeroSrc(sourceIndex + 1);
            delete video.dataset.loadedSrc;

            playVideo(true)
                .catch(function () {
                    return attachSource(true).then(function () {
                        return playVideo(true);
                    });
                })
                .catch(function () {
                    assignHeroSrc(sourceIndex - 1);
                    delete video.dataset.loadedSrc;
                    return attachSource(true).then(function () {
                        return playVideo(true);
                    });
                })
                .catch(function () {
                    /* 仍失败则等 endWatch 再次尝试 */
                })
                .finally(function () {
                    unlockSwitch();
                });
        }

        video.addEventListener('play', startProgressLoop);
        video.addEventListener('pause', function () {
            stopProgressLoop();
            checkAdvance();
        });
        video.addEventListener('ended', function () {
            if (isSwitching) return;
            switchVideos();
        });
        video.addEventListener('timeupdate', function () {
            if (isSwitching) return;
            if (shouldAdvanceVideo()) switchVideos();
        });
        video.addEventListener('error', function () {
            if (isSwitching) return;
            switchVideos();
        });
        video.addEventListener('seeking', function () {
            if (!progressFill || !video.duration) return;
            setProgressScale(progressFill, video.currentTime / video.duration);
        });
        video.addEventListener('loadedmetadata', function () {
            if (video.duration <= 1) return;
            if (video.dataset.heroSkipIntro === '1') {
                delete video.dataset.heroSkipIntro;
                return;
            }
            try {
                video.currentTime = Math.min(video.duration * 0.3, video.duration - 0.2);
            } catch (ignore) {}
        });

        startEndWatch();

        playVideo(false)
            .then(function () {
                preloadOtherWhenIdle();
            })
            .catch(function () {
                playVideo(true)
                    .then(function () {
                        preloadOtherWhenIdle();
                    })
                    .catch(function () {
                        /* 首次播放失败时静默，用户可手动点下一段 */
                    });
            });

        if (nextVideoBtn) {
            nextVideoBtn.addEventListener('click', switchVideos);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible' || isSwitching) return;
            if (shouldAdvanceVideo()) {
                switchVideos();
                return;
            }
            if (video.paused) {
                video.play().then(startProgressLoop).catch(function () {
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
