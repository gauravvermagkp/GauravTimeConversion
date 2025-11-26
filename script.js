// small safety: ensure elements exist before attaching listeners
const istInput = document.getElementById('istInput');
const estInput = document.getElementById('estInput');
let preferredBase = 'IST'; // or 'EST'

if (istInput && estInput) {
    istInput.addEventListener('input', () => {
        if (istInput.value) {
            estInput.value = "";
            estInput.disabled = true;
        } else {
            estInput.disabled = false;
        }
    });

    estInput.addEventListener('input', () => {
        if (estInput.value) {
            istInput.value = "";
            istInput.disabled = true;
        } else {
            istInput.disabled = false;
        }
    });
}

const diffToggle = document.getElementById('toggleDiffs');
if (diffToggle) {
    diffToggle.addEventListener('change', () => {
        if (diffToggle.checked) {
            document.body.classList.remove('diff-hidden');
        } else {
            document.body.classList.add('diff-hidden');
        }
    });
}

function applyPreferredBase() {
    const istBlock = document.getElementById('istInputBlock');
    const estBlock = document.getElementById('estInputBlock');
    if (!istBlock || !estBlock) return;

    if (preferredBase === 'IST') {
        istBlock.style.display = '';
        estBlock.style.display = 'none';

        if (typeof estInput !== 'undefined' && estInput) {
            estInput.value = '';
            estInput.disabled = true;
        }
        if (typeof istInput !== 'undefined' && istInput) {
            istInput.disabled = false;
        }
    } else {
        istBlock.style.display = 'none';
        estBlock.style.display = '';

        if (typeof istInput !== 'undefined' && istInput) {
            istInput.value = '';
            istInput.disabled = true;
        }
        if (typeof estInput !== 'undefined' && estInput) {
            estInput.disabled = false;
        }
    }
}

// listen to radio changes
document.querySelectorAll('input[name="prefLocal"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        preferredBase = e.target.value; // "IST" or "EST"
        applyPreferredBase();
        updateConvertHeader();

        // recompute live diffs
        updateLiveClock();

        // recompute converted section based on whichever input currently has a value
        if (istInput && istInput.value) {
            convertFromIST();
        } else if (estInput && estInput.value) {
            convertFromEST();
        }
    });
});

// initial state
applyPreferredBase();


// Groups mapping
const GROUPS = {
    all: ['all', 'apac', 'emea', 'clar'],
    apac: ['apac'],
    emea: ['emea'],
    clar: ['clar']
};

// Get offset (in minutes) from UTC for a timezone at a given instant
function getOffsetMinutes(instant, timeZone) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = fmt.formatToParts(instant);
    const map = {};
    parts.forEach(p => {
        if (p.type !== 'literal') map[p.type] = p.value;
    });

    const asUTC = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        Number(map.second)
    );

    // offset = local_time_as_UTC - actual_UTC
    return Math.round((asUTC - instant.getTime()) / 60000);
}

// Time difference between given zone with IST and UTC, with half-hour support
function timeDiffLabelIST(tz) {
    const now = new Date();

    const offsetIst = getOffsetMinutes(now, "Asia/Kolkata");
    const offsetOther = getOffsetMinutes(now, tz);

    const diffMinutesist = offsetOther - offsetIst;   // other - IST
    if (diffMinutesist === 0) return "(same as IST)";
    const absMinist = Math.abs(diffMinutesist);
    const hoursist = Math.floor(absMinist / 60);
    const minsist = absMinist % 60;
    const hPartist = hoursist > 0 ? `${hoursist}h` : "";
    const mPartist = minsist > 0 ? `${minsist}m` : "";
    const sepist = hPartist && mPartist ? " " : "";
    const directionist = diffMinutesist > 0 ? "ahead of IST" : "behind IST";

    return `${hPartist}${sepist}${mPartist} ${directionist}`.trim();
}

function timeDiffLabelUTC(tz) {
    const now = new Date();
    const offsetgmt = getOffsetMinutes(now, "UTC");
    const offsetOther = getOffsetMinutes(now, tz);

    const diffMinutesgmt = offsetOther - offsetgmt;   // other - UTC
    if (diffMinutesgmt === 0) return "(same as UTC)";
    const absMingmt = Math.abs(diffMinutesgmt);
    const hoursgmt = Math.floor(absMingmt / 60);
    const minsgmt = absMingmt % 60;
    const hPartgmt = hoursgmt > 0 ? `${hoursgmt}h` : "";
    const mPartgmt = minsgmt > 0 ? `${minsgmt}m` : "";
    const sepgmt = hPartgmt && mPartgmt ? " " : "";
    const directiongmt = diffMinutesgmt > 0 ? "ahead of UTC" : "behind UTC";
    return `${hPartgmt}${sepgmt}${mPartgmt} ${directiongmt}`.trim();
}

function timeDiffLabelEST(tz) {
    const now = new Date();
    const offsetest = getOffsetMinutes(now, "America/New_York");
    const offsetOther = getOffsetMinutes(now, tz);

    const diffMinutesest = offsetOther - offsetest;   // other - EST
    if (diffMinutesest === 0) return "(same as EST)";
    const absMinest = Math.abs(diffMinutesest);
    const hoursest = Math.floor(absMinest / 60);
    const minsest = absMinest % 60;
    const hPartest = hoursest > 0 ? `${hoursest}h` : "";
    const mPartest = minsest > 0 ? `${minsest}m` : "";
    const sepest = hPartest && mPartest ? " " : "";
    const directionest = diffMinutesest > 0 ? "ahead of EST" : "behind EST";
    return `${hPartest}${sepest}${mPartest} ${directionest}`.trim();
}

// Use IST or EST based on preferredBase ("IST" or "EST")
function timeDiffLabelBase(tz) {
    return preferredBase === 'EST' ? timeDiffLabelEST(tz) : timeDiffLabelIST(tz);
}


// Formatter to DD/MM/YYYY hh:mm:ss am/pm in given timezone
function fmtForZone(dateObj, timeZone) {
    const opts = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone
    };
    return dateObj.toLocaleString('en-GB', opts);
}

const AM_CLASS = 'time-am';
const PM_CLASS = 'time-pm';

// classify business-hours bucket for a given instant and timezone
function classifyBusiness(instant, timeZone) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        hour12: false
    });
    const parts = fmt.formatToParts(instant);
    const hourPart = parts.find(p => p.type === 'hour');
    const hour = hourPart ? parseInt(hourPart.value, 10) : NaN;
    if (isNaN(hour)) return 'off';

    // core: 09:00–18:00, off: others (we treat everything else as extended/off)
    if (hour >= 9 && hour < 18) return 'core';
    return 'extended';
}

function applyBusinessClassFromElement(timeElement, instant, timeZone) {
    if (!timeElement || !instant) return;
    const row = timeElement.closest('.zone-row') || timeElement.closest('.est-box');
    if (!row) return;

    row.classList.remove('row-business-core', 'row-business-extended', 'row-business-off');
    const bucket = classifyBusiness(instant, timeZone);
    if (bucket === 'core') {
        row.classList.add('row-business-core');
    } else if (bucket === 'extended') {
        row.classList.add('row-business-extended');
    } else {
        row.classList.add('row-business-off');
    }
}

function clearBusinessClassFromElement(timeElement) {
    if (!timeElement) return;
    const row = timeElement.closest('.zone-row') || timeElement.closest('.est-box');
    if (!row) return;
    row.classList.remove('row-business-core', 'row-business-extended', 'row-business-off');
}

function setTimeWithTone(id, dateObj, timeZone) {
    const el = document.getElementById(id);
    if (!el || !dateObj) return;

    const formatted = fmtForZone(dateObj, timeZone);
    el.innerText = formatted;

    // reset previous tone
    el.classList.remove(AM_CLASS, PM_CLASS);

    const lower = formatted.toLowerCase();
    if (lower.includes(' am')) {
        el.classList.add(AM_CLASS);
    } else if (lower.includes(' pm')) {
        el.classList.add(PM_CLASS);
    }

    // apply business-hours shading
    applyBusinessClassFromElement(el, dateObj, timeZone);
}

function clearTimeDisplay(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerText = text;
    el.classList.remove(AM_CLASS, PM_CLASS);
    clearBusinessClassFromElement(el);
}

function buildDateFromISTInput(val) {
    const parts = val.split('T');
    if (parts.length !== 2) return null;
    const [y, m, d] = parts[0].split('-').map(Number);
    const [hh, mm] = parts[1].split(':').map(Number);
    if ([y, m, d, hh, mm].some(v => Number.isNaN(v))) return null;
    const localUtcMillis = Date.UTC(y, m - 1, d, hh, mm, 0);
    const istOffsetMs = 5.5 * 3600 * 1000; // IST = UTC+5:30
    const utcMillis = localUtcMillis - istOffsetMs;
    return new Date(utcMillis);
}

function buildDateFromESTInput(val) {
    const parts = val.split('T');
    if (parts.length !== 2) return null;
    const [y, m, d] = parts[0].split('-').map(Number);
    const [hh, mm] = parts[1].split(':').map(Number);
    if ([y, m, d, hh, mm].some(v => Number.isNaN(v))) return null;
    const localUtcMillis = Date.UTC(y, m - 1, d, hh, mm, 0);
    const estOffsetMs = 5 * 3600 * 1000; // EST = UTC-5:00 (approx, without DST)
    const utcMillis = localUtcMillis + estOffsetMs;
    return new Date(utcMillis);
}

// helper: numeric key for timezone at an instant (YYYYMMDDHHMMSS)
function zoneKeyForInstant(instant, tz) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = fmt.formatToParts(instant);
    const map = {};
    parts.forEach(p => {
        if (p.type !== 'literal') map[p.type] = p.value;
    });
    return Number(map.year + map.month + map.day + map.hour + map.minute + map.second);
}

function highlightSort(tableId, asc) {
    const btns = document.querySelectorAll(`button.sort-btn[data-target="${tableId}"]`);
    btns.forEach(btn => btn.classList.remove("active"));

    const selector = asc
        ? `button.sort-btn[data-target="${tableId}"][data-dir="asc"]`
        : `button.sort-btn[data-target="${tableId}"][data-dir="desc"]`;

    const activeBtn = document.querySelector(selector);
    if (activeBtn) activeBtn.classList.add("active");
}

// sort rows in a table by timezone local time at a reference instant
function sortZones(tableId, asc = true, referenceInstant = null) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('.zone-row'));
    const instant = referenceInstant || new Date();
    const decorated = rows.map(r => ({
        r,
        key: zoneKeyForInstant(instant, r.getAttribute('data-tz') || 'UTC')
    }));
    highlightSort(tableId, asc);
    decorated.sort((a, b) => asc ? a.key - b.key : b.key - a.key);
    decorated.forEach(d => table.appendChild(d.r));
}

function updateLiveClock() {
    const now = new Date();
    const map = {
        liveEST: 'America/New_York',
        liveIST: 'Asia/Kolkata',
        liveSYD: 'Australia/Sydney',
        liveBER: 'Europe/Berlin',
        liveAFR: 'Africa/Johannesburg',
        liveBRA: 'Brazil/East',
        liveCAN: 'America/Toronto',
        liveFRA: 'Europe/Berlin',
        liveDEU: 'Europe/Berlin',
        liveJPN: 'Japan',
        liveMEX: 'America/Mexico_City',
        liveNLD: 'Europe/Berlin',
        livePOL: 'Europe/Warsaw',
        liveESP: 'Europe/Berlin',
        liveCHE: 'Europe/Berlin',
        liveTHA: 'Asia/Bangkok'
    };

    Object.keys(map).forEach(id => {
        setTimeWithTone(id, now, map[id]);
        const diffIst = document.getElementById("diff-ist-" + id);
        const diffUTC = document.getElementById("diff-utc-" + id);

        if (diffIst) diffIst.innerText = timeDiffLabelBase(map[id]);
        if (diffUTC) diffUTC.innerText = timeDiffLabelUTC(map[id]);
    });

    // Also shade the primary EST live box
    const estBig = document.getElementById('liveEST');
    if (estBig) applyBusinessClassFromElement(estBig, now, 'America/New_York');
}

setInterval(updateLiveClock, 1000);
updateLiveClock();

function clearConvertedDiffs(keys) {
    keys.forEach(k => {
        const diffIst = document.getElementById("diff-ist-" + k);
        const diffUTC = document.getElementById("diff-utc-" + k);
        if (diffIst) diffIst.innerText = "";
        if (diffUTC) diffUTC.innerText = "";
    });
}

function convertFromIST() {
    const val = document.getElementById('istInput').value;
    const keys = ['convertedEST', 'convertedSYD', 'convertedIST', 'convertedBER',
        'convertedAFR', 'convertedBRA', 'convertedCAN', 'convertedFRA', 'convertedDEU',
        'convertedJPN', 'convertedMEX', 'convertedNLD', 'convertedPOL', 'convertedESP', 'convertedCHE', 'convertedTHA'];

    if (!val) {
        keys.forEach(k => clearTimeDisplay(k, '--'));
        clearConvertedDiffs(keys);
        return;
    }

    const istDateObj = buildDateFromISTInput(val);
    if (!istDateObj || isNaN(istDateObj.getTime())) {
        keys.forEach(k => clearTimeDisplay(k, 'Invalid Date'));
        clearConvertedDiffs(keys);
        return;
    }

    const convMap = {
        convertedEST: 'America/New_York',
        convertedSYD: 'Australia/Sydney',
        convertedIST: 'Asia/Kolkata',
        convertedBER: 'Europe/Berlin',
        convertedAFR: 'Africa/Johannesburg',
        convertedBRA: 'Brazil/East',
        convertedCAN: 'America/Toronto',
        convertedFRA: 'Europe/Berlin',
        convertedDEU: 'Europe/Berlin',
        convertedJPN: 'Japan',
        convertedMEX: 'America/Mexico_City',
        convertedNLD: 'Europe/Berlin',
        convertedPOL: 'Europe/Warsaw',
        convertedESP: 'Europe/Berlin',
        convertedCHE: 'Europe/Berlin',
        convertedTHA: 'Asia/Bangkok'
    };

    Object.keys(convMap).forEach(id => {
        setTimeWithTone(id, istDateObj, convMap[id]);
        const diffIst = document.getElementById("diff-ist-" + id);
        const diffUTC = document.getElementById("diff-utc-" + id);

        if (diffIst) diffIst.innerText = timeDiffLabelBase(convMap[id]);
        if (diffUTC) diffUTC.innerText = timeDiffLabelUTC(convMap[id]);
    });

    // Shade primary converted EST box as well
    const estBig = document.getElementById('convertedEST');
    if (estBig) applyBusinessClassFromElement(estBig, istDateObj, 'America/New_York');

    // auto-sort converted table ascending by the converted local times for that IST instant
    sortZones('convTable', true, istDateObj);
}

function convertFromEST() {
    const val = document.getElementById('estInput').value;
    const keys = ['convertedEST', 'convertedSYD', 'convertedIST', 'convertedBER',
        'convertedAFR', 'convertedBRA', 'convertedCAN', 'convertedFRA', 'convertedDEU',
        'convertedJPN', 'convertedMEX', 'convertedNLD', 'convertedPOL', 'convertedESP', 'convertedCHE', 'convertedTHA'];

    if (!val) {
        keys.forEach(k => clearTimeDisplay(k, '--'));
        clearConvertedDiffs(keys);
        return;
    }

    const estDateObj = buildDateFromESTInput(val);
    if (!estDateObj || isNaN(estDateObj.getTime())) {
        keys.forEach(k => clearTimeDisplay(k, 'Invalid Date'));
        clearConvertedDiffs(keys);
        return;
    }

    const convMap = {
        convertedEST: 'America/New_York',
        convertedSYD: 'Australia/Sydney',
        convertedIST: 'Asia/Kolkata',
        convertedBER: 'Europe/Berlin',
        convertedAFR: 'Africa/Johannesburg',
        convertedBRA: 'Brazil/East',
        convertedCAN: 'America/Toronto',
        convertedFRA: 'Europe/Berlin',
        convertedDEU: 'Europe/Berlin',
        convertedJPN: 'Japan',
        convertedMEX: 'America/Mexico_City',
        convertedNLD: 'Europe/Berlin',
        convertedPOL: 'Europe/Warsaw',
        convertedESP: 'Europe/Berlin',
        convertedCHE: 'Europe/Berlin',
        convertedTHA: 'Asia/Bangkok'
    };

    Object.keys(convMap).forEach(id => {
        setTimeWithTone(id, estDateObj, convMap[id]);
        const diffIst = document.getElementById("diff-ist-" + id);
        const diffUTC = document.getElementById("diff-utc-" + id);

        if (diffIst) diffIst.innerText = timeDiffLabelIST(convMap[id]);
        if (diffUTC) diffUTC.innerText = timeDiffLabelUTC(convMap[id]);
    });

    const estBig = document.getElementById('convertedEST');
    if (estBig) applyBusinessClassFromElement(estBig, estDateObj, 'America/New_York');

    // auto-sort converted table ascending by the converted local times for that EST instant
    sortZones('convTable', true, estDateObj);
}

function applyGroupLive() {
    const sel = document.getElementById('groupSelectLive').value;
    const allowed = GROUPS[sel] || GROUPS.all;
    document.querySelectorAll('#liveTable .zone-row').forEach(el => {
        el.style.display = allowed.includes(el.getAttribute('data-zone') || 'all') ? '' : 'none';
    });
}

function applyGroupConv() {
    const sel = document.getElementById('groupSelectConv').value;
    const allowed = GROUPS[sel] || GROUPS.all;
    document.querySelectorAll('#convTable .zone-row').forEach(el => {
        el.style.display = allowed.includes(el.getAttribute('data-zone') || 'all') ? '' : 'none';
    });
}


function updateConvertHeader() {
    const header = document.getElementById('convertHeader');
    if (!header) return;
    header.innerText = preferredBase === 'EST'
        ? 'Convert EST → Other Zones'
        : 'Convert IST → Other Zones';
}

function toggleSection(bodyId, btn) {
    const body = document.getElementById(bodyId);
    if (!body) return;

    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? '' : 'none';

    if (btn) {
        btn.textContent = isHidden ? '−' : '+';
    }
}

// initialize
applyGroupLive();
applyGroupConv();
