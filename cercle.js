/* Pi est calcule dans un Worker avec la serie de Chudnovsky.
   Le cercle utilise ensuite une approximation de pi adaptee aux pixels.
   Un million de decimales n'augmente pas la resolution de l'ecran. */
const circleCanvas = document.getElementById("cercle-pi");
const piStatus = document.getElementById("etat-pi");
const piDigits = document.getElementById("decimales-pi");
const circleTheme = document.getElementById("neo-theme");
let piWorker = null;
let piFrame = null;
let piTimeout = null;
let piRun = 0;

function stopPi() {
    piRun++;
    if (piWorker) piWorker.terminate();
    piWorker = null;
    cancelAnimationFrame(piFrame);
    clearTimeout(piTimeout);
    piStatus.textContent = "Calcul de π et dessin arrêtés.";
}

function startPi() {
    stopPi();
    const run = piRun;
    piDigits.textContent = "";
    piStatus.textContent = "Calcul de π à un million de décimales…";
    const code = `
        function split(a,b) {
            if (b-a === 1) {
                if (a === 0) return [1n,1n,13591409n];
                const k=BigInt(a);
                const p=(6n*k-5n)*(2n*k-1n)*(6n*k-1n);
                const q=k*k*k*10939058860032000n;
                let t=p*(13591409n+545140134n*k);
                if (a%2) t=-t;
                return [p,q,t];
            }
            const m=Math.floor((a+b)/2);
            const left=split(a,m), right=split(m,b);
            return [left[0]*right[0],left[1]*right[1],left[2]*right[1]+left[0]*right[2]];
        }
        onmessage=function(){
            const started=performance.now();
            const digits=1000000, guard=20;
            const terms=Math.ceil((digits+guard)/14)+2;
            postMessage({status:"Calcul de la série de Chudnovsky : "+terms+" termes…"});
            const [p,q,t]=split(0,terms);
            postMessage({status:"Calcul de la racine carrée et division haute précision…"});
            const base=10n**BigInt(digits+guard);
            const n=10005n*base*base;
            let root=101n*base;
            while(true){const next=(root+n/root)/2n;if(next>=root)break;root=next;}
            const raw=(426880n*root*q/t).toString();
            const value=raw[0]+","+raw.slice(1,1+digits);
            postMessage({value,seconds:(performance.now()-started)/1000});
        };
    `;
    const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));
    piWorker=new Worker(url);
    URL.revokeObjectURL(url);
    piTimeout=setTimeout(function(){
        if(run!==piRun)return;
        stopPi();
        piStatus.textContent="Limite de deux minutes atteinte. Utilise le bouton pour relancer.";
    },120000);
    piWorker.onerror=function(){stopPi();piStatus.textContent="Calcul indisponible dans ce navigateur.";};
    piWorker.onmessage=function(event){
        if(run!==piRun || circleTheme.checked)return;
        const result=event.data;
        if(result.status){piStatus.textContent=result.status;return;}
        clearTimeout(piTimeout);
        piDigits.textContent=result.value;
        piWorker.terminate(); piWorker=null;
        const pi=Number(result.value.slice(0,18).replace(",","."));
        const width=Math.max(240,Math.min(800,circleCanvas.clientWidth || 500));
        const dpr=Math.min(devicePixelRatio || 1,2);
        circleCanvas.width=Math.round(width*dpr);
        circleCanvas.height=Math.round(width*0.75*dpr);
        const ctx=circleCanvas.getContext("2d");
        ctx.scale(dpr,dpr);
        const palette=getComputedStyle(document.body);
        ctx.fillStyle=palette.getPropertyValue("--fond").trim();
        ctx.fillRect(0,0,width,width*0.75);
        ctx.strokeStyle=palette.getPropertyValue("--accent").trim();
        ctx.lineWidth=2;
        const radius=width*0.3,cx=width/2,cy=width*0.375,total=1000000;
        let index=0,previous=null;
        function draw(){
            if(run!==piRun || circleTheme.checked)return;
            const end=Math.min(total+1,index+4000);
            ctx.beginPath();
            if(previous)ctx.moveTo(previous[0],previous[1]);
            for(;index<end;index++){
                const angle=2*pi*index/total;
                const point=[cx+radius*Math.cos(angle),cy+radius*Math.sin(angle)];
                if(!previous)ctx.moveTo(point[0],point[1]);else ctx.lineTo(point[0],point[1]);
                previous=point;
            }
            ctx.stroke();
            piStatus.textContent="π calculé en "+result.seconds.toFixed(2)+" s · cercle : "+Math.min(100,Math.floor(index/total*100))+" %";
            if(index<=total)piFrame=requestAnimationFrame(draw);
            else piStatus.textContent="Cercle terminé · π calculé à 1 000 000 décimales. Dessin limité aux pixels de l’écran.";
        }
        draw();
    };
    piWorker.postMessage("start");
}
document.getElementById("arreter-pi").addEventListener("click",stopPi);
document.getElementById("relancer-pi").addEventListener("click",function(){if(!circleTheme.checked)startPi();});
circleTheme.addEventListener("change",function(){if(circleTheme.checked)stopPi();else startPi();});
window.addEventListener("pagehide",stopPi);
requestAnimationFrame(function(){setTimeout(function(){if(!circleTheme.checked)startPi();},0);});
