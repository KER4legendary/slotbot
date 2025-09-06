// slot.js — финальная версия: логика по нижнему ряду (WIN_ROW=2), визуальная линия
(() => {
    const WIN_W = 1920, WIN_H = 1080;
    const FPS = 60;
  
    const REELS = 3;
    const ROWS = 3;
    const CELL = 120;
    const GAP = 14;
    const VIEW_W = REELS * CELL + (REELS - 1) * GAP;
    const VIEW_H = ROWS * CELL + (ROWS - 1) * GAP;
  
    const BG = "rgb(14,16,26)";
    const PANEL = "rgb(20,24,44)";
    const TEXT = "rgb(232,235,245)";
    const MUTED = "rgb(154,163,178)";
    const ACCENT = "rgb(88,166,255)";
    const WIN_COLOR = "rgb(117,224,167)";
    const LOSE_COLOR = "rgb(239,91,119)";
    const DEPOSIT_COLOR = "rgb(220,53,69)";
  
    // Вероятности
    const P_FLAG_TRIPLE = 1 / 1000;   // 3 флага -> +15 free spins
    const P_SEVEN_TRIPLE = 1 / 20;    // 3 семёрки
    const P_STRAW_TRIPLE = 1 / 12;    // 3 клубники
    const P_BANANA_TRIPLE = 1 / 7;    // 3 банана
    const P_2_BANANA = 1 / 5;         // любые 2 банана
    const P_2_STRAW = 1 / 5;          // любые 2 клубники
  
    const BRAND_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/2560px-Flag_of_Russia.svg.png";
    const BANK_ICON_URL = "https://cdn.tbank.ru/static/pages/files/89d99c76-3ce7-4abe-9e3e-34253f7d706c.png";
    const DEPOSIT_URL = "https://example.com/deposit";
  
    const SYMBOLS = [
      { key: "banana",     label: "B",  fg: "rgb(30,30,30)",   bg: "rgb(255,212,59)",  payout3: 1.5, payout2: 1.0, weight: 6, img: "banana.png" },
      { key: "strawberry", label: "S",  fg: "rgb(30,30,30)",   bg: "rgb(255,80,100)",  payout3: 2.0, payout2: 1.2, weight: 5, img: "strawberry.png" },
      { key: "flag_ru",    label: "RU", fg: "rgb(255,255,255)", bg: "rgb(60,90,160)",   payout3: 0.0, payout2: 0.0, weight: 4, img: "Flag_of_Russia.png" },
      { key: "seven",      label: "7",  fg: "rgb(255,255,255)", bg: "rgb(255,120,0)",   payout3: 5.0, payout2: 0.0, weight: 2, img: "seven.png" },
    ];
  
    // winning row index: логика использует нижнюю строку (index 2)
    const WIN_ROW = 2;
  
    function randRange(a,b){ return a + Math.random()*(b-a); }
    function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  
    function weightedPick(){
      const total = SYMBOLS.reduce((s,x)=>s+x.weight,0);
      let r = Math.random()*total;
      for (let s of SYMBOLS){
        r -= s.weight;
        if (r < 0) return s;
      }
      return SYMBOLS[SYMBOLS.length-1];
    }
  
    function buildSequence(repeats = 14){
      const seq = [];
      for (let i=0;i<repeats;i++){
        for (let s of SYMBOLS) seq.push(s);
      }
      return seq;
    }
  
    function loadImage(src){
      return new Promise(res=>{
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
      });
    }
  
    function drawRoundedRect(ctx, x, y, w, h, r){
      const rad = typeof r === "number" ? r : 8;
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    }
  
    // canvas sizing: сделаем canvas full-screen и адаптируем pixel ratio
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
  
    function resizeCanvas(){
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  
    let mouse = { x:0, y:0, inside:false };
  
    class SlotGame {
      constructor(){
        // состояние
        this.balance = 1000.0;
        this.bet = 50;
        this.toast = "";
        this.toastColor = TEXT;
        this.toastTill = 0;
        this.freeSpins = 0;
        this.history = [];
  
        this.viewRect = { x: 0, y: 0, w: VIEW_W + 24, h: VIEW_H + 24 };
        this.viewRect.x = Math.floor((window.innerWidth - this.viewRect.w) / 2);
        this.viewRect.y = Math.floor((window.innerHeight - this.viewRect.h) / 2 - 20);
  
        this.btnSpin = { x: 0, y: 0, w: 160, h: 48 };
        this.btnSpin.x = Math.floor(window.innerWidth / 2 - this.btnSpin.w / 2);
        this.btnSpin.y = this.viewRect.y + this.viewRect.h + 50;
  
        this.btnMax = { x: this.btnSpin.x + this.btnSpin.w + 12, y: this.btnSpin.y, w: 130, h: 48 };
        this.btnReset = { x: this.btnSpin.x - 142, y: this.btnSpin.y, w: 130, h: 48 };
        this.btnBetMinus = { x: this.viewRect.x, y: this.btnSpin.y + this.btnSpin.h + 12, w: 48, h: 40 };
        this.btnBetPlus = { x: this.viewRect.x + 56, y: this.btnSpin.y + this.btnSpin.h + 12, w: 48, h: 40 };
  
        this.btnDeposit = { w: 240, h: 72 };
        this.btnDeposit.x = this.viewRect.x + this.viewRect.w + 20;
        this.btnDeposit.y = Math.floor(this.viewRect.y + this.viewRect.h / 2 - this.btnDeposit.h / 2);
  
        this.brandImg = null;
        this.brandRect = { x: 12, y: 12, w: 96, h: 128 };
  
        this.bankImg = null;
        this.bankRect = { w: 22, h: 22 };
  
        this.bgImg = null;
  
        this.sndWin = null;
        this.sndLose = null;
        this.sndDing = null;
  
        this.reelsSeq = [buildSequence(), buildSequence(), buildSequence()];
        this.reelSurfaces = [null, null, null];
        this.reelOffsets = [0,0,0];
        this.reelTargets = [0,0,0];
        this.reelDurations = [0,0,0];
        this.reelStartTimes = [0,0,0];
        this.spinning = false;
        this.targetGrid = Array.from({length:ROWS}, ()=>Array(REELS).fill(null));
        this.reelStopped = [false,false,false];
        this.lineFlashUntil = 0;
  
        this.hover = { spin:false, max:false, reset:false, minus:false, plus:false, deposit:false };
  
        this._loadAssets();
        this._bindEvents();
  
        this._lastTime = performance.now();
        this._animLoop = this._animLoop.bind(this);
        requestAnimationFrame(this._animLoop);
      }
  
      async _loadAssets(){
        let b = await loadImage("brand.png");
        if(!b) b = await loadImage(BRAND_URL);
        if(b) this.brandImg = b;
  
        let bg = await loadImage("background.jpg");
        if(!bg) bg = await loadImage("background1.jpg");
        if(!bg) bg = await loadImage("background1.png");
        if(bg) this.bgImg = bg;
  
        let bank = await loadImage("bank.png");
        if(!bank) bank = await loadImage(BANK_ICON_URL);
        if(bank) this.bankImg = bank;
  
        try{ this.sndWin = new Audio("perechislenie-deneg.mp3"); } catch(e){ this.sndWin = null; }
        try{ this.sndLose = new Audio("in-the-mouth-of-this-casino.mp3"); } catch(e){ this.sndLose = null; }
        try{ this.sndDing = new Audio("slot-machine-insert-coin-ding_f1gbpf4d.mp3"); } catch(e){ this.sndDing = null; }
  
        for (let s of SYMBOLS){
          if (s.img){
            const img = await loadImage(s.img);
            if (img) s._cachedImg = img;
          }
        }
  
        for (let i=0;i<REELS;i++){
          this.reelSurfaces[i] = this._renderStripToCanvas(this.reelsSeq[i]);
        }
      }
  
      _renderCellToCanvas(symbol){
        const off = document.createElement("canvas");
        off.width = CELL; off.height = CELL;
        const c = off.getContext("2d");
        c.clearRect(0,0,CELL,CELL);
        const cx = CELL/2, cy = CELL/2, r = CELL/2 - 10;
        c.save();
        c.beginPath();
        c.fillStyle = "rgba(0,0,0,0.15)";
        c.arc(cx, cy + 8, r, 0, Math.PI*2);
        c.fill();
  
        c.beginPath();
        c.fillStyle = symbol.bg;
        c.arc(cx, cy, r, 0, Math.PI*2);
        c.fill();
  
        if(symbol._cachedImg){
          c.beginPath();
          c.arc(cx, cy, r-2, 0, Math.PI*2);
          c.clip();
          const img = symbol._cachedImg;
          const ratio = Math.min((r*2 - 8)/img.width, (r*2 - 8)/img.height);
          const w = img.width * ratio, h = img.height * ratio;
          const x = cx - w/2, y = cy - h/2;
          c.drawImage(img, x, y, w, h);
        } else {
          c.fillStyle = symbol.fg;
          c.font = "bold 64px sans-serif";
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(symbol.label, cx, cy);
        }
        c.restore();
        return off;
      }
  
      _renderStripToCanvas(seq){
        const h = seq.length * CELL;
        const off = document.createElement("canvas");
        off.width = CELL;
        off.height = h;
        const c = off.getContext("2d");
        for (let i=0;i<seq.length;i++){
          const sym = seq[i];
          const cellCanvas = this._renderCellToCanvas(sym);
          c.drawImage(cellCanvas, 0, i * CELL);
        }
        return off;
      }
  
      _buildTargetGridWithProbabilities(){
        const r = Math.random();
        let cumulative = 0;
        const grid = Array.from({length:ROWS}, ()=>Array(REELS).fill(null));
  
        const fillRemaining = (forcedRow) => {
          for (let c=0;c<REELS;c++){
            if (forcedRow && forcedRow[c]) grid[WIN_ROW][c] = forcedRow[c];
            else grid[WIN_ROW][c] = weightedPick();
          }
          for (let rr=0; rr<ROWS; rr++){
            if (rr === WIN_ROW) continue;
            for (let c=0;c<REELS;c++) grid[rr][c] = weightedPick();
          }
        };
  
        cumulative += P_FLAG_TRIPLE;
        if (r < cumulative){
          const f = SYMBOLS.find(s=>s.key==="flag_ru");
          fillRemaining([f,f,f]);
          return {grid, special:"flags_triple"};
        }
  
        cumulative += P_SEVEN_TRIPLE;
        if (r < cumulative){
          const s = SYMBOLS.find(sy=>sy.key==="seven");
          fillRemaining([s,s,s]);
          return {grid, special:"seven_triple"};
        }
  
        cumulative += P_STRAW_TRIPLE;
        if (r < cumulative){
          const s = SYMBOLS.find(sy=>sy.key==="strawberry");
          fillRemaining([s,s,s]);
          return {grid, special:"straw_triple"};
        }
  
        cumulative += P_BANANA_TRIPLE;
        if (r < cumulative){
          const s = SYMBOLS.find(sy=>sy.key==="banana");
          fillRemaining([s,s,s]);
          return {grid, special:"banana_triple"};
        }
  
        cumulative += P_2_BANANA;
        if (r < cumulative){
          const s = SYMBOLS.find(sy=>sy.key==="banana");
          const idx = [0,1,2];
          for (let i=idx.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
          const forced = [null,null,null];
          forced[idx[0]] = s;
          forced[idx[1]] = s;
          const other = SYMBOLS.filter(sym=>sym.key!=="banana");
          forced[idx[2]] = other[Math.floor(Math.random()*other.length)];
          fillRemaining(forced);
          return {grid, special:"banana_double"};
        }
  
        cumulative += P_2_STRAW;
        if (r < cumulative){
          const s = SYMBOLS.find(sy=>sy.key==="strawberry");
          const idx = [0,1,2];
          for (let i=idx.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
          const forced = [null,null,null];
          forced[idx[0]] = s;
          forced[idx[1]] = s;
          const other = SYMBOLS.filter(sym=>sym.key!=="strawberry");
          forced[idx[2]] = other[Math.floor(Math.random()*other.length)];
          fillRemaining(forced);
          return {grid, special:"straw_double"};
        }
  
        fillRemaining(null);
        return {grid, special:null};
      }
  
      startSpin(){
        if (this.spinning) return;
        const usingFree = this.freeSpins > 0;
        if (!usingFree){
          if (this.bet > this.balance){
            this._toast("Недостаточно средств", LOSE_COLOR, 1.2);
            return;
          }
          this.balance -= this.bet;
        } else {
          this.freeSpins = Math.max(0, this.freeSpins - 1);
          this._toast(`Free spin! Осталось: ${this.freeSpins}`, ACCENT, 1.2);
        }
  
        this.spinning = true;
        this.reelStopped = [false,false,false];
  
        const {grid, special} = this._buildTargetGridWithProbabilities();
        this.targetGrid = grid;
  
        for (let c=0;c<REELS;c++){
          const forced = [this.targetGrid[0][c], this.targetGrid[1][c], this.targetGrid[2][c]];
          let seq = buildSequence();
          seq = seq.concat(forced);
          this.reelsSeq[c] = seq;
          this.reelSurfaces[c] = this._renderStripToCanvas(seq);
        }
  
        const t = Date.now()/1000;
        const base = 0.9 + randRange(0.15,0.45);
        for (let i=0;i<REELS;i++){
          const totalCells = this.reelsSeq[i].length;
          const totalH = totalCells * CELL;
          const cur = this.reelOffsets[i] % totalH;
          const targetIndexMid = totalCells - 2;
          const extraTurns = 6 + i + Math.floor(Math.random()*4);
          const baseIndex = Math.ceil(cur / CELL);
          const extraCells = extraTurns * totalCells + ((targetIndexMid - baseIndex) % totalCells);
          const targetOffset = (baseIndex + extraCells) * CELL;
          const dur = base + i * 0.7 + randRange(0, 0.2);
          this.reelStartTimes[i] = t;
          this.reelDurations[i] = dur;
          this.reelTargets[i] = targetOffset;
          this.reelOffsets[i] = cur;
        }
      }
  
      _finishSpin(){
        this.spinning = false;
        const a = this.targetGrid[WIN_ROW][0], b = this.targetGrid[WIN_ROW][1], c = this.targetGrid[WIN_ROW][2];
  
        if (a.key === "flag_ru" && b.key === "flag_ru" && c.key === "flag_ru"){
          this.freeSpins += 15;
          this._toast("Вы получили 15 бесплатных прокрутов! 🎉", WIN_COLOR, 2.0);
          if (this.sndWin) try{ this.sndWin.currentTime = 0; this.sndWin.play(); }catch(e){}
          this.lineFlashUntil = Date.now()/1000 + 1.2;
          this._pushHistory({type:"3x🇷🇺", payout:0, free:15});
          return;
        }
  
        if (a.key === b.key && b.key === c.key){
          const sym = a;
          const payout = (sym.payout3 || 0) * this.bet;
          if (payout > 0){
            this.balance += payout;
            this._toast(`Вы выиграли ${payout.toFixed(2)}!`, WIN_COLOR, 1.6);
            if (this.sndWin) try{ this.sndWin.currentTime = 0; this.sndWin.play(); }catch(e){}
            this.lineFlashUntil = Date.now()/1000 + 1.0;
            this._pushHistory({type:`3x${this._emojiFor(sym.key)}`, payout:payout, free:0});
          } else {
            this._toast("Победа (без выплаты)", WIN_COLOR, 1.0);
            this._pushHistory({type:`3x${this._emojiFor(sym.key)}`, payout:0, free:0});
          }
          return;
        }
  
        const keys = [a.key, b.key, c.key];
        const counts = {};
        for (let k of keys) counts[k] = (counts[k] || 0) + 1;
        for (let k in counts){
          if (counts[k] === 2){
            const sym = SYMBOLS.find(s=>s.key===k);
            const payoutMult = sym ? (sym.payout2 || 0) : 0;
            const payout = payoutMult * this.bet;
            if (payout > 0){
              this.balance += payout;
              this._toast(`Вы получили ${payout.toFixed(2)} за пару ${this._emojiFor(k)}`, WIN_COLOR, 1.4);
              if (this.sndWin) try{ this.sndWin.currentTime = 0; this.sndWin.play(); }catch(e){}
              this.lineFlashUntil = Date.now()/1000 + 0.9;
              this._pushHistory({type:`${this._emojiFor(k)}x2`, payout:payout, free:0});
            } else {
              this._toast("Пара, но без выплаты", LOSE_COLOR, 1.0);
              this._pushHistory({type:`${this._emojiFor(k)}x2`, payout:0, free:0});
            }
            return;
          }
        }
  
        this._toast("Не повезло. Попробуйте снова", LOSE_COLOR, 1.0);
        if (this.sndLose) try{ this.sndLose.currentTime = 0; this.sndLose.play(); }catch(e){}
        this._pushHistory({type:"0", payout:0, free:0});
      }
  
      _pushHistory(entry){
        const item = {...entry, time: Date.now()};
        this.history.unshift(item);
        if (this.history.length > 12) this.history.length = 12;
      }
  
      _emojiFor(key){
        if (key==="banana") return "🍌";
        if (key==="strawberry") return "🍓";
        if (key==="flag_ru") return "🇷🇺";
        if (key==="seven") return "7️⃣";
        return key;
      }
  
      _toast(text, color, secs){
        this.toast = text; this.toastColor = color; this.toastTill = Date.now()/1000 + secs;
      }
  
      _bindEvents(){
        window.addEventListener("keydown", (ev)=>{
          if (ev.code === "Space"){ ev.preventDefault(); this.startSpin(); }
          else if (ev.key === "r" || ev.key === "R"){ this.balance = 1000.0; this._toast("Баланс сброшен", TEXT, 0.8); }
          else if (ev.key === "+" || ev.key === "="){ this.bet = Math.min(1000, this.bet + 10); }
          else if (ev.key === "-"){ this.bet = Math.max(10, this.bet - 10); }
          else if (ev.key === "m" || ev.key === "M"){ this.bet = 100; this.startSpin(); }
        });
  
        canvas.addEventListener("mousemove", (e)=>{
          const rect = canvas.getBoundingClientRect();
          mouse.x = (e.clientX - rect.left);
          mouse.y = (e.clientY - rect.top);
          mouse.inside = true;
          this.hover.spin = this._hitTest(this.btnSpin, mouse);
          this.hover.max = this._hitTest(this.btnMax, mouse);
          this.hover.reset = this._hitTest(this.btnReset, mouse);
          this.hover.minus = this._hitTest(this.btnBetMinus, mouse);
          this.hover.plus = this._hitTest(this.btnBetPlus, mouse);
          this.hover.deposit = this._hitTest(this.btnDeposit, mouse) && this.balance < 350;
        });
  
        canvas.addEventListener("mouseleave", ()=>{
          mouse.inside = false;
          for (let k in this.hover) this.hover[k] = false;
        });
  
        canvas.addEventListener("click", (e)=>{
          const rect = canvas.getBoundingClientRect();
          const mx = (e.clientX - rect.left);
          const my = (e.clientY - rect.top);
          const hit = (btn) => mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h;
  
          if (hit(this.btnSpin)) this.startSpin();
          else if (hit(this.btnMax)) { this.bet = 100; this.startSpin(); }
          else if (hit(this.btnReset)) { this.balance = 1000.0; this._toast("Баланс сброшен", TEXT, 0.8); }
          else if (hit(this.btnBetMinus)) { this.bet = Math.max(10, this.bet - 10); }
          else if (hit(this.btnBetPlus)) { this.bet = Math.min(1000, this.bet + 10); }
          else if (hit(this.btnDeposit) && this.balance < 350) {
            this.balance += 1000; this._toast("Баланс пополнен на 1000!", WIN_COLOR, 1.5);
            try{ window.open(DEPOSIT_URL, "_blank"); }catch(e){}
          }
        });
      }
  
      _hitTest(btn, mousePos){
        return mousePos && mousePos.x >= btn.x && mousePos.x <= btn.x + btn.w && mousePos.y >= btn.y && mousePos.y <= btn.y + btn.h;
      }
  
      _update(dt){
        if (this.spinning){
          let allDone = true;
          const tNow = Date.now()/1000;
          for (let i=0;i<REELS;i++){
            const t0 = this.reelStartTimes[i];
            const d = this.reelDurations[i];
            let cur = this.reelOffsets[i];
            const target = this.reelTargets[i];
            const totalCells = this.reelsSeq[i].length;
            const totalH = totalCells * CELL;
  
            const elapsed = Math.max(0, tNow - t0);
            if (elapsed < d){
              allDone = false;
              const p = easeOutCubic(elapsed / d);
              const newOffset = (1 - p) * cur + p * target;
              this.reelOffsets[i] = newOffset;
            } else {
              this.reelOffsets[i] = target;
              if (!this.reelStopped[i]){
                this.reelStopped[i] = true;
                if (this.sndDing) try{ this.sndDing.currentTime = 0; this.sndDing.play(); }catch(e){}
              }
            }
            const totalHpos = totalCells * CELL;
            this.reelOffsets[i] = ((this.reelOffsets[i] % totalHpos) + totalHpos) % totalHpos;
          }
          if (allDone) this._finishSpin();
        }
      }
  
      // Комбинации — слева (x=18)
      _drawCombinationsLeft(){
        const combos = [
          { emoji: "🇷🇺", text: "3 × Флаг → 15 бесплатных прокрутов (шанс 1/1000)" },
          { emoji: "🍌", text: "3 × Банан → ×1.5 (шанс ~1/7)" },
          { emoji: "🍓", text: "3 × Клубника → ×2 (шанс ~1/12)" },
          { emoji: "7️⃣", text: "3 × 7 → ×5 (шанс ~1/20)" },
          { emoji: "🍌🍌", text: "2 × Банан → ×1 (шанс ~1/5)" },
          { emoji: "🍓🍓", text: "2 × Клубника → ×1.2 (шанс ~1/5)" },
        ];
        const x = 18;
        let y = this.brandRect.y + this.brandRect.h + 12;
        ctx.save();
        ctx.textAlign = "left";
        ctx.font = "bold 18px sans-serif";
        ctx.fillStyle = TEXT;
        ctx.fillText("Комбинации:", x, y);
        y += 26;
        ctx.font = "15px sans-serif";
        for (let c of combos){
          ctx.fillText(`${c.emoji}  ${c.text}`, x, y);
          y += 20;
        }
        ctx.restore();
      }
  
      _drawHistory(x, yTop){
        const boxW = 260;
        const boxH = 220;
        const x0 = x;
        const y0 = yTop;
        drawRoundedRect(ctx, x0, y0, boxW, boxH, 10);
        ctx.fillStyle = "rgba(20,24,36,0.7)";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.stroke();
  
        ctx.fillStyle = TEXT;
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("История", x0 + 12, y0 + 22);
  
        ctx.font = "14px sans-serif";
        const maxShow = Math.min(8, this.history.length);
        let y = y0 + 44;
        for (let i=0;i<maxShow;i++){
          const it = this.history[i];
          const label = it.type === "0" ? "Нет" : it.type;
          const payoutText = it.payout ? `+${it.payout.toFixed(2)}` : (it.free ? `+${it.free}FS` : "");
          ctx.fillStyle = TEXT;
          ctx.fillText(label, x0 + 12, y);
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.textAlign = "right";
          ctx.fillText(payoutText, x0 + boxW - 12, y);
          ctx.textAlign = "left";
          y += 22;
        }
      }
  
      _drawButton(btn, text, color, disabled=false, hover=false){
        const bg = disabled ? "rgb(30,34,52)" : "rgb(36,42,64)";
        drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
        ctx.fillStyle = bg; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "rgb(60,68,96)"; ctx.stroke();
        if (hover && !disabled){ ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = "white"; drawRoundedRect(ctx, btn.x, btn.y, btn.w, btn.h, 10); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = disabled ? MUTED : color;
        ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(text, btn.x + btn.w/2, btn.y + btn.h/2);
      }
  
      _drawDepositButton(btn, timeSec){
        const pulse = 1 + 0.03 * Math.sin(timeSec * 6);
        const w = btn.w * pulse, h = btn.h * pulse;
        const x = btn.x - (w - btn.w)/2, y = btn.y - (h - btn.h)/2;
        drawRoundedRect(ctx, x, y, w, h, 12); ctx.fillStyle = DEPOSIT_COLOR; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = "rgb(255,100,100)"; ctx.stroke();
        ctx.fillStyle = TEXT; ctx.font="bold 32px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("ДОДЕП!!!", x + w/2, y + h/2 - 10);
        ctx.font="bold 20px sans-serif"; ctx.fillText("+1000", x + w/2, y + h/2 + 18);
      }
  
      _draw(){
        const now = Date.now()/1000;
  
        if (this.bgImg){
          // scale bg to full screen
          ctx.drawImage(this.bgImg, 0, 0, window.innerWidth, window.innerHeight);
          ctx.fillStyle = "rgba(6,8,12,0.35)"; ctx.fillRect(0,0,window.innerWidth, window.innerHeight);
        } else {
          ctx.fillStyle = BG; ctx.fillRect(0,0,window.innerWidth, window.innerHeight);
        }
  
        ctx.fillStyle = TEXT; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "left";
        ctx.fillText("Однорукий бандит", this.viewRect.x, this.viewRect.y - 56);
        ctx.font = "18px sans-serif"; ctx.fillStyle = MUTED;
        ctx.fillText("Крутите барабаны. 3 одинаковых — победа.", this.viewRect.x, this.viewRect.y - 30);
  
        if (this.brandImg) ctx.drawImage(this.brandImg, this.brandRect.x, this.brandRect.y, this.brandRect.w, this.brandRect.h);
  
        // left combos
        this._drawCombinationsLeft();
  
        // view panel
        ctx.fillStyle = PANEL; drawRoundedRect(ctx, this.viewRect.x, this.viewRect.y, this.viewRect.w, this.viewRect.h, 12); ctx.fill();
        const inner = { x: this.viewRect.x + 12, y: this.viewRect.y + 12, w: this.viewRect.w - 24, h: this.viewRect.h - 24 };
        ctx.fillStyle = "rgb(38,44,68)"; drawRoundedRect(ctx, inner.x, inner.y, inner.w, inner.h, 10); ctx.fill();
  
        ctx.save(); ctx.beginPath(); ctx.rect(inner.x, inner.y, inner.w, inner.h); ctx.clip();
  
        const tiltAmp = this.spinning ? 6 : 0;
        const tiltFreq = 2.5;
  
        for (let i=0;i<REELS;i++){
          const strip = this.reelSurfaces[i];
          if (!strip) continue;
          const totalH = strip.height;
          const wiggle = tiltAmp * Math.sin(now * tiltFreq + i * 0.8);
          const x = inner.x + i * (CELL + GAP);
          const y = inner.y - Math.floor(this.reelOffsets[i]) % totalH + wiggle;
          ctx.drawImage(strip, x, y);
          ctx.drawImage(strip, x, y + totalH);
        }
  
        ctx.restore();
  
        // VISUAL: draw green bar one row above the logical winning row (only visuals changed)
        if (now < this.lineFlashUntil) {
          const yMidLogical = inner.y + WIN_ROW * (CELL + GAP) + CELL / 2;
          const rowShift = (CELL + GAP); // shift up one row for visuals
          const yMidVis = yMidLogical - rowShift;
  
          ctx.fillStyle = WIN_COLOR;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(inner.x, yMidVis - 3, inner.w, 6);
          ctx.globalAlpha = 1;
  
          for (let c=0;c<REELS;c++){
            const cx = inner.x + c * (CELL + GAP) + CELL / 2;
            const cy = yMidVis;
            ctx.beginPath();
            ctx.arc(cx, cy, CELL/2 - 6, 0, Math.PI*2);
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.lineWidth = 6;
            ctx.stroke();
          }
        }
  
        this._drawButton(this.btnReset, "Сброс", LOSE_COLOR, false, this.hover.reset);
        this._drawButton(this.btnSpin, "SPIN", this.spinning ? MUTED : WIN_COLOR, this.spinning, this.hover.spin);
        this._drawButton(this.btnMax, "MAX BET", ACCENT, false, this.hover.max);
  
        if (this.balance < 350) this._drawDepositButton(this.btnDeposit, now);
  
        const histX = this.viewRect.x + this.viewRect.w + 18;
        const histY = this.viewRect.y;
  
        const histBoxW = 260;
        ctx.fillStyle = TEXT; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`Баланс: ${this.balance.toFixed(2)}`, histX + histBoxW/2, histY + 2);
  
        this._drawHistory(histX, histY + 20);
  
        ctx.fillStyle = PANEL; drawRoundedRect(ctx, this.btnBetMinus.x, this.btnBetMinus.y, 104, 40, 8); ctx.fill();
        this._drawButton(this.btnBetMinus, "−", TEXT, false, this.hover.minus);
        this._drawButton(this.btnBetPlus, "+", TEXT, false, this.hover.plus);
  
        ctx.fillStyle = TEXT; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "left";
        const betTextX = this.btnSpin.x + this.btnSpin.w + 14;
        const betTextY = this.btnSpin.y + this.btnSpin.h + 72;
        ctx.fillText(`Ставка: ${this.bet}`, betTextX, betTextY);
  
        if (this.freeSpins > 0){
          ctx.fillStyle = ACCENT; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "left";
          ctx.fillText(`Free spins: ${this.freeSpins}`, this.viewRect.x, this.viewRect.y - 12);
        }
  
        if (Date.now()/1000 < this.toastTill && this.toast){
          ctx.fillStyle = this.toastColor; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(this.toast, window.innerWidth/2, this.viewRect.y + this.viewRect.h + 8);
        }
  
        ctx.fillStyle = TEXT; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "left";
        const msg = "Депать по СБП по номеру +7 977 772-26-81";
        const msgX = 18; const msgY = window.innerHeight - 20;
        if (this.bankImg) { ctx.drawImage(this.bankImg, msgX, msgY - this.bankRect.h, this.bankRect.w, this.bankRect.h); ctx.fillText(msg, msgX + this.bankRect.w + 8, msgY); }
        else ctx.fillText(msg, msgX, msgY);
      }
  
      _animLoop(now){
        const dt = (now - this._lastTime)/1000;
        this._lastTime = now;
        this._update(dt);
        this._draw();
        requestAnimationFrame(this._animLoop);
      }
    }
  
    // старт
    new SlotGame();
  })();
  