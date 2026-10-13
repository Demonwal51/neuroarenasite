/* Le Worker calcule phi, puis les points par lots.
   Le canvas trace chaque lot recu, pas une image precalculee.
   Le bouton arrete immediatement le Worker et efface le dessin. */
const theme = document.getElementById("neo-theme");
const canvas = document.getElementById("spirale-or");
const statusText = document.getElementById("etat-calcul");
const digitsOutput = document.getElementById("decimales-or");
let worker = null;
let generation = 0;

function stopCalculation() {
    generation++;
    if (worker) { worker.terminate(); worker = null; }
    statusText.textContent = "Calcul et tracé désactivés — reviens à NeuroArena pour relancer.";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    digitsOutput.textContent = "";
}

function startCalculation() {
    if (worker) worker.terminate();
    const thisRun = ++generation;
    statusText.textContent = "Calcul de 30 000 décimales…";
    digitsOutput.textContent = "";
    const size = Math.min(900, Math.max(280, canvas.clientWidth || 500));
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * scale);
    canvas.height = Math.round(size * 0.7 * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    const palette = getComputedStyle(document.body);
    ctx.fillStyle = palette.getPropertyValue("--fond").trim();
    ctx.fillRect(0, 0, size, size * 0.7);
    ctx.strokeStyle = palette.getPropertyValue("--accent").trim();
    ctx.lineWidth = 2;
    let previousPoint = null;

    const code = `
        onmessage = function (event) {
            const { width, height } = event.data;
            const started = performance.now();
            const places = 30000;
            const base = 10n ** BigInt(places);
            const n = 5n * base * base;
            let x = 3n * base;
            while (true) {
                const next = (x + n / x) / 2n;
                if (next >= x) break;
                x = next;
                if (performance.now() - started > 10000) {
                    postMessage({ error: "Limite de calcul atteinte. Relance avec le bouton de thème." });
                    return;
                }
            }
            // 30 000 decimales tronquees calculees avec BigInt.
            const raw = ((base + x) / 2n).toString();
            const value = raw[0] + "," + raw.slice(1);
            postMessage({ value });
            // Le trace utilise des nombres flottants : sa precision est
            // adaptee aux pixels, et non aux 30 000 decimales de phi.
            const phi = Number(raw[0] + "." + raw.slice(1, 17));
            const growth = 2 * Math.log(phi) / Math.PI;
            const total = 24000;
            const radius = Math.min(width, height) * 0.42;
            let index = 0;
            function calculateBatch() {
                // 120 nouveaux points sont reellement calcules a chaque lot.
                const points = [];
                const end = Math.min(total + 1, index + 120);
                while (index < end) {
                    const angle = -8 * Math.PI + 8 * Math.PI * index / total;
                    const r = radius * Math.exp(growth * angle);
                    points.push([width * 0.49 + r * Math.cos(angle),
                        height * 0.52 + r * Math.sin(angle)]);
                    index++;
                }
                const done = index > total;
                postMessage({ points, count: index, total: total + 1, done,
                    seconds: (performance.now() - started) / 1000 });
                // Espacer les lots rend leur progression visible.
                // Si l'onglet est lent, le trace prend plus de temps.
                if (!done) setTimeout(calculateBatch, 25);
            }
            calculateBatch();
        };
    `;
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = function (event) {
        // Ignore un ancien calcul apres une bascule de theme.
        if (thisRun !== generation || theme.checked) return;
        const result = event.data;
        if (result.error) {
            statusText.textContent = result.error;
            worker.terminate(); worker = null;
        } else if (result.value) {
            digitsOutput.textContent = result.value;
        } else if (result.points) {
            ctx.beginPath();
            if (previousPoint) ctx.moveTo(previousPoint[0], previousPoint[1]);
            result.points.forEach(function (point) {
                if (!previousPoint) ctx.moveTo(point[0], point[1]);
                else ctx.lineTo(point[0], point[1]);
                previousPoint = point;
            });
            ctx.stroke();
            const percent = Math.floor(result.count / result.total * 100);
            statusText.textContent = "Tracé calculé : " + percent + " % — "
                + result.count.toLocaleString("fr-FR") + " points / "
                + result.total.toLocaleString("fr-FR");
            if (result.done) {
                statusText.textContent = "Terminé : 30 000 décimales et "
                    + result.total.toLocaleString("fr-FR") + " points calculés en "
                    + result.seconds.toFixed(2) + " s. Dessin limité à la précision de l’écran.";
                worker.terminate(); worker = null;
            }
        }
    };
    worker.onerror = function () {
        statusText.textContent = "Calcul indisponible dans ce navigateur.";
        if (worker) worker.terminate(); worker = null;
    };
    worker.postMessage({ width: size, height: size * 0.7 });
}

theme.addEventListener("change", function () {
    if (theme.checked) stopCalculation(); else startCalculation();
});
// Le bouton et le HTML s'affichent avant le lancement du Worker.
requestAnimationFrame(function () {
    setTimeout(function () {
        if (!theme.checked) startCalculation(); else stopCalculation();
    }, 0);
});
