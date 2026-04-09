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
let settings = { roman: true, sound: true, art: true };

function setupGrid() {
    const boxes = document.querySelectorAll('.letter-box');
    boxes.forEach((el) => {
        const i = parseInt(el.dataset.index);
        el.id = `L${i}`;
        const hint = document.createElement('span');
        hint.className = 'roman-hint';
        hint.innerText = romanMap[i];
        el.appendChild(hint);

        el.onmousedown = (e) => { e.preventDefault(); startDragging(i); };
        el.onmouseenter = () => { if (isDragging) updateDragging(i); };
        el.ontouchstart = (e) => { if (e.cancelable) e.preventDefault(); startDragging(i); };

        el.onclick = () => {
            if (!isDragging) {
                startSelectionIdx = i;
                endSelectionIdx = i;
                currentIdx = i;
                //triggerLetter(true);
                playSingleClick(i);
            }
        };
    });

    window.onmouseup = window.ontouchend = () => { 
        if (isDragging) {
            isDragging = false;
            currentIdx = Math.min(startSelectionIdx, endSelectionIdx);
            togglePlay();
        }
    };
    stopPlayback();
}

function refreshGrid() {
    const low = (startSelectionIdx !== null) ? Math.min(startSelectionIdx, endSelectionIdx) : -1;
    const high = (startSelectionIdx !== null) ? Math.max(startSelectionIdx, endSelectionIdx) : -1;
    document.querySelectorAll('.letter-box').forEach((box, idx) => {
        box.classList.remove('active', 'selected-range');
        if (idx >= low && idx <= high && low !== -1) {
            box.classList.add('selected-range');
        }
        if (idx === currentIdx) {
            // Keep orange highlight visible even when paused
            if (isPlaying || (startSelectionIdx !== null)) {
                box.classList.add('active');
            }
        }
    });
}

function startDragging(idx) {
    isDragging = true;
    isPlaying = false;
    if (audioObj) audioObj.pause();
    startSelectionIdx = idx;
    endSelectionIdx = idx;
    currentIdx = idx;
    refreshGrid();
}

function updateDragging(idx) {
    endSelectionIdx = idx;
    currentIdx = Math.min(startSelectionIdx, endSelectionIdx);
    refreshGrid();
}

function toggleSetting(type) {
    settings[type] = !settings[type];
    const btn = document.getElementById(`toggle-${type}`);
    // Show the action the user can take
    btn.innerText = settings[type] ? 'OFF' : 'ON';
    btn.classList.toggle('on', settings[type]);
    btn.classList.toggle('off', !settings[type]);
    if (type === 'roman') syncUI();
    if (type === 'art') document.getElementById('articulation-focus').style.visibility = settings[type] ? 'visible' : 'hidden';
}

/**
 * FIXED: Resumes from currentIdx instead of resetting to the start of the selection.
 */
function togglePlay() {
    const playLabel = document.getElementById('play-label');
    const pauseLabel = document.getElementById('pause-label');

    if (!isPlaying) {
        isPlaying = true;
        
        // Update repetition counts from UI
        letterRepsLeft = parseInt(document.getElementById('letterReps').value) || 1;
        
        // Handle "Play All" logic for default state
        if (startSelectionIdx === null) {
		    startSelectionIdx = 0;
		    endSelectionIdx = letters.length - 1;
		}

        // Only set selectRepsLeft if we aren't already mid-loop
        if (selectRepsLeft <= 1) {
            selectRepsLeft = (startSelectionIdx === endSelectionIdx) ? 1 : (parseInt(document.getElementById('selectReps').value) || 1);
        }

        playLabel.style.display = 'none';
        pauseLabel.style.display = 'block';
        triggerLetter(true);
    } else {
        pausePlayback();
    }
}

function pausePlayback() {
    isPlaying = false;
    if (audioObj) { audioObj.pause(); audioObj.onended = null; }
    document.getElementById('play-label').style.display = 'block';
    document.getElementById('pause-label').style.display = 'none';
    refreshGrid();
}

function triggerLetter(shouldPlay = true) {
    if (audioObj) { audioObj.pause(); audioObj = null; }
    const low = Math.min(startSelectionIdx, endSelectionIdx);
    const high = Math.max(startSelectionIdx, endSelectionIdx);

    document.getElementById('big-letter').innerText = letters[currentIdx];
    document.getElementById('big-roman').innerText = romanMap[currentIdx];
    document.getElementById('big-roman').style.visibility = settings.roman ? 'visible' : 'hidden';

    const name = artNames[artPoints[currentIdx]];
    document.getElementById('articulation-text').innerText = name;
    const imgEl = document.getElementById('articulation-img');
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
	            setTimeout(() => { 
	                currentIdx++; 
	                triggerLetter(true); 
	            }, gap);
	        } else {
	            if (selectRepsLeft > 1) {
	                selectRepsLeft--;
	                currentIdx = low; 
	                const gap = parseInt(document.getElementById('gapRange').value);
	                setTimeout(() => triggerLetter(true), gap);
	            } else {
	                // --- THE CHANGE IS HERE ---
	                currentIdx = low;       // Move playhead back to the start
	                selectRepsLeft = 1;     // Reset the repetition counter
	                pausePlayback();        // Stop the sequence
	                triggerLetter(false);   // Update UI/Big Letter without playing sound
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

function stopPlayback() {
    pausePlayback();
    startSelectionIdx = 0;
    endSelectionIdx = 0;
    currentIdx = 0;
    selectRepsLeft = 1; // Fully reset loop counter
    refreshGrid();
    triggerLetter(false);
}

function syncUI() {
    document.getElementById('big-roman').style.visibility = settings.roman ? 'visible' : 'hidden';
    document.querySelectorAll('.roman-hint').forEach(hint => {
        hint.style.opacity = settings.roman ? '1' : '0';
    });
}

setupGrid();
syncUI();
