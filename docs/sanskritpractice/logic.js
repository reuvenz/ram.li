const letters = ["अ","आ","इ","ई","उ","ऊ","ऋ","ॠ","ऌ","ए","ऐ","ओ","औ","अं","अः","क","ख","ग","घ","ङ","च","छ","ज","झ","ञ","ट","ठ","ड","ढ","ण","त","थ","द","ध","न","प","फ","ब","भ","म","य","र","ल","व","श","ष","स","ह"];
const romanMap = ["a","ā","i","ī","u","ū","ṛ","ṝ","ḷ","e","ai","o","au","aṃ","aḥ","ka","kha","ga","gha","ṅa","ca","cha","ja","jha","ña","ṭa","ṭha","ḍa","ḍha","ṇa","ta","tha","da","dha","na","pa","pha","ba","bha","ma","ya","ra","la","va","śa","ṣa","sa","ha"];
const artPoints = [1,1,2,2,5,5,3,3,4,6,6,7,7,8,9,1,1,1,1,1,2,2,2,2,2,3,3,3,3,3,4,4,4,4,4,5,5,5,5,5,2,3,4,5,2,3,4,1];
const artNames = ["","Guttural","Palatal","Cerebral","Dental","Labial","Guttural-Palatal","Guttural-Labial","Nasal","Aspirate"];

let isPlaying = false;
let audioObj = null;
let currentIdx = 0;
let letterRepsLeft = 1;
let selectRepsLeft = 1;
let startSelectionIdx = null;
let endSelectionIdx = null;
let isDragging = false;
let hintTimer = null;        // mobile roman-hint tooltip timer
const isTouchDevice = () => window.matchMedia('(hover: none)').matches;
let settings = { roman: true, sound: true, art: true };

/* ── helpers ─────────────────────────────────────────────── */

/** Return the letter-box element under a touch point, or null. */
function boxFromTouch(touch) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    // walk up in case the touch lands on a child (roman-hint span etc.)
    const box = el.closest('.letter-box');
    return box;
}

/* ── grid setup ──────────────────────────────────────────── */

function setupGrid() {
    const boxes = document.querySelectorAll('.letter-box');

    boxes.forEach((el) => {
        const i = parseInt(el.dataset.index);
        el.id = `L${i}`;

        // Roman transliteration hover hint
        const hint = document.createElement('span');
        hint.className = 'roman-hint';
        hint.innerText = romanMap[i];
        el.appendChild(hint);

        /* ── MOUSE events ── */
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startDragging(i);
        });

        el.addEventListener('mouseenter', () => {
            if (isDragging) updateDragging(i);
        });

        el.addEventListener('click', () => {
            if (!isDragging) {
                startSelectionIdx = i;
                endSelectionIdx   = i;
                currentIdx        = i;
                playSingleClick(i);
            }
        });

        /* ── TOUCH events ──
           touchstart on the element begins the drag.
           touchmove / touchend are handled on window (see below)
           so they fire even when the finger slides off the element. */
        el.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            startDragging(i);

            // Mobile roman hint: show briefly on tap if roman is ON
            if (settings.roman) {
                if (hintTimer) clearTimeout(hintTimer);
                // clear any existing hint on other boxes
                document.querySelectorAll('.letter-box.show-hint')
                    .forEach(b => b.classList.remove('show-hint'));
                el.classList.add('show-hint');
                hintTimer = setTimeout(() => {
                    el.classList.remove('show-hint');
                    hintTimer = null;
                }, 1500);
            }
        }, { passive: false });
    });

    /* ── Global MOUSE up ── */
    window.addEventListener('mouseup', () => {
        if (isDragging) finishDrag();
    });

    /* ── Global TOUCH move — track which box the finger is over ── */
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const box = boxFromTouch(touch);
        if (box && box.dataset.index !== undefined) {
            updateDragging(parseInt(box.dataset.index));
        }
    }, { passive: false });

    /* ── Global TOUCH end ── */
    window.addEventListener('touchend', () => {
        if (isDragging) finishDrag();
    });

    stopPlayback();
}

function finishDrag() {
    isDragging = false;
    currentIdx = Math.min(startSelectionIdx, endSelectionIdx);
    togglePlay();
}

/* ── drag helpers ─────────────────────────────────────────── */

function startDragging(idx) {
    isDragging = true;
    isPlaying  = false;
    if (audioObj) audioObj.pause();
    // clear any lingering hint tooltip
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
    document.querySelectorAll('.letter-box.show-hint')
        .forEach(b => b.classList.remove('show-hint'));
    startSelectionIdx = idx;
    endSelectionIdx   = idx;
    currentIdx        = idx;
    refreshGrid();
}

function updateDragging(idx) {
    endSelectionIdx = idx;
    currentIdx = Math.min(startSelectionIdx, endSelectionIdx);
    refreshGrid();
}

/* ── grid refresh ─────────────────────────────────────────── */

function refreshGrid() {
    const low  = (startSelectionIdx !== null) ? Math.min(startSelectionIdx, endSelectionIdx) : -1;
    const high = (startSelectionIdx !== null) ? Math.max(startSelectionIdx, endSelectionIdx) : -1;

    document.querySelectorAll('.letter-box').forEach((box, idx) => {
        box.classList.remove('active', 'selected-range');
        if (low !== -1 && idx >= low && idx <= high) {
            box.classList.add('selected-range');
        }
        if (idx === currentIdx) {
            if (isPlaying || startSelectionIdx !== null) {
                box.classList.add('active');
            }
        }
    });
}

/* ── settings toggles ─────────────────────────────────────── */

function toggleSetting(type) {
    settings[type] = !settings[type];
    const btn = document.getElementById(`toggle-${type}`);
    btn.innerText = settings[type] ? 'OFF' : 'ON';
    btn.classList.toggle('on',  settings[type]);
    btn.classList.toggle('off', !settings[type]);
    if (type === 'roman') syncUI();
    if (type === 'art') {
        document.getElementById('articulation-focus').style.visibility =
            settings[type] ? 'visible' : 'hidden';
    }
}

/* ── playback ─────────────────────────────────────────────── */

function togglePlay() {
    const playLabel  = document.getElementById('play-label');
    const pauseLabel = document.getElementById('pause-label');

    if (!isPlaying) {
        isPlaying = true;
        letterRepsLeft = parseInt(document.getElementById('letterReps').value) || 1;

        if (startSelectionIdx === null) {
            startSelectionIdx = 0;
            endSelectionIdx   = letters.length - 1;
        }

        if (selectRepsLeft <= 1) {
            selectRepsLeft = (startSelectionIdx === endSelectionIdx)
                ? 1
                : (parseInt(document.getElementById('selectReps').value) || 1);
        }

        playLabel.style.display  = 'none';
        pauseLabel.style.display = 'block';
        triggerLetter(true);
    } else {
        pausePlayback();
    }
}

function pausePlayback() {
    isPlaying = false;
    if (audioObj) { audioObj.pause(); audioObj.onended = null; }
    document.getElementById('play-label').style.display  = 'block';
    document.getElementById('pause-label').style.display = 'none';
    refreshGrid();
}

function triggerLetter(shouldPlay = true) {
    if (audioObj) { audioObj.pause(); audioObj = null; }

    const low  = Math.min(startSelectionIdx, endSelectionIdx);
    const high = Math.max(startSelectionIdx, endSelectionIdx);

    document.getElementById('big-letter').innerText = letters[currentIdx];
    document.getElementById('big-roman').innerText  = romanMap[currentIdx];
    document.getElementById('big-roman').style.visibility = settings.roman ? 'visible' : 'hidden';

    const name  = artNames[artPoints[currentIdx]];
    const imgEl = document.getElementById('articulation-img');
    document.getElementById('articulation-text').innerText = name;
    if (name && settings.art) {
        imgEl.src = `images/${name.toLowerCase()}.png`;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }

    refreshGrid();

    const onLetterFinished = () => {
        if (!isPlaying) return;

        if (letterRepsLeft > 1) {
            letterRepsLeft--;
            setTimeout(() => triggerLetter(true), 300);
        } else {
            letterRepsLeft = parseInt(document.getElementById('letterReps').value) || 1;

            if (currentIdx < high) {
                const gap = parseInt(document.getElementById('gapRange').value);
                setTimeout(() => { currentIdx++; triggerLetter(true); }, gap);
            } else {
                if (selectRepsLeft > 1) {
                    selectRepsLeft--;
                    currentIdx = low;
                    const gap = parseInt(document.getElementById('gapRange').value);
                    setTimeout(() => triggerLetter(true), gap);
                } else {
                    currentIdx     = low;
                    selectRepsLeft = 1;
                    pausePlayback();
                    triggerLetter(false);
                }
            }
        }
    };

    if (shouldPlay && isPlaying) {
        if (settings.sound) {
            audioObj = new Audio(`sounds/v${currentIdx + 1}.mp3`);
            audioObj.onended = onLetterFinished;
            audioObj.play().catch(() => setTimeout(onLetterFinished, 500));
        } else {
            setTimeout(onLetterFinished, 800);
        }
    }
}

function playSingleClick(idx) {
    if (audioObj) { audioObj.pause(); audioObj = null; }
    document.getElementById('big-letter').innerText = letters[idx];
    document.getElementById('big-roman').innerText  = romanMap[idx];
    document.getElementById('big-roman').style.visibility = settings.roman ? 'visible' : 'hidden';

    const name  = artNames[artPoints[idx]];
    const imgEl = document.getElementById('articulation-img');
    document.getElementById('articulation-text').innerText = name;
    if (name && settings.art) {
        imgEl.src = `images/${name.toLowerCase()}.png`;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }

    refreshGrid();

    if (settings.sound) {
        audioObj = new Audio(`sounds/v${idx + 1}.mp3`);
        audioObj.play().catch(() => {});
    }
}

function stopPlayback() {
    pausePlayback();
    startSelectionIdx = 0;
    endSelectionIdx   = 0;
    currentIdx        = 0;
    selectRepsLeft    = 1;
    refreshGrid();
    triggerLetter(false);
}

function syncUI() {
    document.getElementById('big-roman').style.visibility = settings.roman ? 'visible' : 'hidden';
    document.querySelectorAll('.roman-hint').forEach(hint => {
        hint.style.opacity = settings.roman ? '1' : '0';
    });
    // clear mobile hint tooltips when roman is turned off
    if (!settings.roman) {
        if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
        document.querySelectorAll('.letter-box.show-hint')
            .forEach(b => b.classList.remove('show-hint'));
    }
}

setupGrid();
syncUI();
