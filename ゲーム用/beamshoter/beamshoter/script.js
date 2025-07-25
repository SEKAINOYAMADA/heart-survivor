// ビームシューター：障害物破壊ゲーム
// ここにゲームロジックを実装していきます

// --- 基本セットアップ ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ゲーム状態
const GAME_STATE = {
  READY: 'ready',      // 開始前
  PLAYING: 'playing',  // プレイ中
  GAMEOVER: 'gameover' // ゲームオーバー
};
let gameState = GAME_STATE.READY;

// スコア・タイマー
let startTime = 0;
let score = 0;

// --- プレイヤークラス ---
class Player {
  constructor() {
    this.width = 32;
    this.height = 40; // □+〇の合計高さ
    this.x = canvas.width / 2;
    this.y = canvas.height - 30; // より下側に
    this.speed = 6;
    this.moveLeft = false;
    this.moveRight = false;
  }

  update() {
    if (this.moveLeft) {
      this.x -= this.speed;
    }
    if (this.moveRight) {
      this.x += this.speed;
    }
    // ステージ端で止める
    this.x = Math.max(this.width / 2, Math.min(canvas.width - this.width / 2, this.x));
  }

  draw(ctx) {
    // □部分（上）
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    // □
    ctx.fillRect(this.x - 12, this.y - 32, 24, 16);
    // 〇（下）
    ctx.beginPath();
    ctx.arc(this.x, this.y - 12, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

let player = new Player();

// --- ビームクラス ---
class Beam {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 6;
    this.height = 16;
    this.speed = 12;
    this.active = true;
  }

  update() {
    this.y -= this.speed;
    if (this.y + this.height < 0) {
      this.active = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#fff';
    // ドット絵風の「・」
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

let beams = [];

// --- 障害物クラス ---
class Obstacle {
  constructor(x, y, value, vx) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.maxValue = value;
    this.radius = this.calcRadius();
    this.vx = vx; // 横速度
    this.vy = 2;  // 初期落下速度
    this.gravity = 0.3;
    this.spawnY = y; // 初回出現時の高さ
    this.active = true;
    this.lastBounceY = y;
  }

  calcRadius() {
    // 2桁台:20, 3桁台:26, 以降100ごとに+6
    if (this.value < 100) return 20;
    return 20 + Math.floor((this.value - 100) / 100 + 1) * 6;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.radius = this.calcRadius();

    // 壁反射
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx *= -1;
    }
    if (this.x + this.radius > canvas.width) {
      this.x = canvas.width - this.radius;
      this.vx *= -1;
    }
    // 下バウンド（spawnYまでバウンド）
    if (this.y + this.radius > canvas.height) {
      this.y = canvas.height - this.radius;
      // バウンド後のvyを計算（vy^2 = 2g(h) → vy = -sqrt(2g(h))）
      const h = canvas.height - this.radius - this.spawnY;
      this.vy = -Math.sqrt(2 * this.gravity * h);
    }
    // 上は画面外に出ない
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    // 数字
    ctx.fillStyle = '#000';
    ctx.font = `${Math.max(16, this.radius)}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.value, this.x, this.y + 2);
    ctx.restore();
  }
}

let obstacles = [];
let obstacleTimer = 0;
let nextObstacleInterval = 2000; // ms

// --- 障害物生成: 体力10+ランダム増加 ---
function getObstacleValueByTime() {
  // 20秒単位で体力増加
  const elapsed = (performance.now() - startTime) / 1000;
  if (elapsed < 20) return 10 + Math.floor(Math.random() * 10); // 10-19
  if (elapsed < 40) return 30 + Math.floor(Math.random() * 20); // 30-49
  return 80 + Math.floor(Math.random() * 40); // 80-119
}

function spawnObstacle() {
  // 上部左右どちらかから出現
  const side = Math.random() < 0.5 ? 0 : canvas.width;
  const x = side === 0 ? 24 : canvas.width - 24;
  const y = 24;
  const value = getObstacleValueByTime();
  const vx = (side === 0 ? 1 : -1) * (Math.random() * 3 + 2); // 2~5
  obstacles.push(new Obstacle(x, y, value, vx));
}

// --- 衝突判定関数 ---
function isCircleRectColliding(cx, cy, cr, rx, ry, rw, rh) {
  // 円と矩形の衝突判定
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (cr * cr);
}

function isCircleCircleColliding(x1, y1, r1, x2, y2, r2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < (r1 + r2);
}

// --- 自動ビーム連射設定 ---
let autoBeamTimer = 0;
const AUTO_BEAM_INTERVAL = 80; // ms（さらに速く）

// --- ビーム発射関数（どこからでも使えるように上部へ） ---
function shootBeam() {
  if (gameState !== GAME_STATE.PLAYING) return;
  // □部分の中央から発射
  const beamX = player.x;
  const beamY = player.y - 32;
  beams.push(new Beam(beamX, beamY));
}

// --- モバイル判定関数（どこからでも使えるように上部へ） ---
function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// --- スマホ用左右ボタン生成 ---
function createMobileControls() {
  if (document.getElementById('mobile-controls')) return;
  const controls = document.createElement('div');
  controls.id = 'mobile-controls';
  controls.style.position = 'fixed';
  controls.style.left = '0';
  controls.style.right = '0';
  controls.style.bottom = '0';
  controls.style.width = '100vw';
  controls.style.height = '80px';
  controls.style.display = 'flex';
  controls.style.justifyContent = 'space-between';
  controls.style.zIndex = '10';
  controls.innerHTML = `
    <button id="btn-left" style="flex:1;font-size:2rem;height:100%;background:#222;color:#fff;border:none;font-family:'Press Start 2P',monospace;">◀</button>
    <button id="btn-right" style="flex:1;font-size:2rem;height:100%;background:#222;color:#fff;border:none;font-family:'Press Start 2P',monospace;">▶</button>
  `;
  document.body.appendChild(controls);

  // タッチイベント
  document.getElementById('btn-left').addEventListener('touchstart', e => { e.preventDefault(); player.moveLeft = true; });
  document.getElementById('btn-left').addEventListener('touchend', e => { e.preventDefault(); player.moveLeft = false; });
  document.getElementById('btn-right').addEventListener('touchstart', e => { e.preventDefault(); player.moveRight = true; });
  document.getElementById('btn-right').addEventListener('touchend', e => { e.preventDefault(); player.moveRight = false; });
}

function removeMobileControls() {
  const controls = document.getElementById('mobile-controls');
  if (controls) controls.remove();
}

// ゲームループ
function gameLoop() {
  // 画面クリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 状態ごとに描画・処理
  if (gameState === GAME_STATE.READY) {
    drawReadyScreen();
  } else if (gameState === GAME_STATE.PLAYING) {
    updateGame();
    drawGame();
  } else if (gameState === GAME_STATE.GAMEOVER) {
    drawGameOverScreen();
  }

  requestAnimationFrame(gameLoop);
}

// --- 状態ごとの描画 ---
// --- UI/UX微調整 ---
function drawReadyScreen() {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = '24px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('クリックまたはスペースでスタート！', canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

// --- スコアを整数で表示 ---
function drawGame() {
  // スコア表示
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = '18px "Press Start 2P"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SCORE', 20, 16);
  ctx.font = '20px "Press Start 2P"';
  ctx.fillText(score, 20, 44);
  ctx.restore();
  // ビーム描画
  beams.forEach(beam => beam.draw(ctx));
  // 障害物描画
  obstacles.forEach(obs => obs.draw(ctx));
  // プレイヤー描画
  player.draw(ctx);
}

function drawGameOverScreen() {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = '36px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ゲームオーバー', canvas.width / 2, canvas.height / 2 - 60);
  ctx.font = '20px "Press Start 2P"';
  ctx.fillText('スコア', canvas.width / 2, canvas.height / 2);
  ctx.font = '28px "Press Start 2P"';
  ctx.fillText(score, canvas.width / 2, canvas.height / 2 + 40);
  ctx.font = '16px "Press Start 2P"';
  ctx.fillText('クリックまたはスペースでリトライ', canvas.width / 2, canvas.height / 2 + 90);
  ctx.restore();
}

// --- ゲーム更新処理に衝突判定追加 ---
function updateGame() {
  // スコア更新（0.001秒ごとに1点, 整数）
  score = Math.floor((performance.now() - startTime) / 1); // 1ms=1点,整数
  // ビーム更新・削除
  beams.forEach(beam => beam.update());
  beams = beams.filter(beam => beam.active);
  player.update();
  // 障害物更新
  obstacles.forEach(obs => obs.update());
  // 障害物生成タイマー
  if (gameState === GAME_STATE.PLAYING) {
    obstacleTimer += 1000 / 60;
    if (obstacleTimer > nextObstacleInterval) {
      spawnObstacle();
      obstacleTimer = 0;
      // 次の出現間隔をランダム化
      nextObstacleInterval = 3000 + Math.random() * 4000; // 3~7秒
    }
  }
  // 画面外・消滅した障害物は削除（今後: value=0で消滅も追加）
  obstacles = obstacles.filter(obs => obs.active);

  // ビームと障害物の衝突
  beams.forEach(beam => {
    obstacles.forEach(obs => {
      if (!obs.active || !beam.active) return;
      if (isCircleRectColliding(obs.x, obs.y, obs.radius, beam.x - 3, beam.y - 8, 6, 16)) {
        obs.value--;
        beam.active = false;
        if (obs.value <= 0) {
          obs.active = false;
          score += 2; // 障害物破壊ボーナス
        }
      }
    });
  });

  // プレイヤーと障害物の衝突
  obstacles.forEach(obs => {
    if (!obs.active) return;
    if (isCircleRectColliding(obs.x, obs.y, obs.radius, player.x - player.width / 2, player.y - 32, player.width, player.height)) {
      gameState = GAME_STATE.GAMEOVER;
    }
  });

  // 障害物同士の衝突
  for (let i = 0; i < obstacles.length; i++) {
    for (let j = i + 1; j < obstacles.length; j++) {
      const a = obstacles[i], b = obstacles[j];
      if (!a.active || !b.active) continue;
      if (isCircleCircleColliding(a.x, a.y, a.radius, b.x, b.y, b.radius)) {
        // 速度ベクトルを単純に交換（反射）
        const tempVx = a.vx;
        const tempVy = a.vy;
        a.vx = b.vx;
        a.vy = b.vy;
        b.vx = tempVx;
        b.vy = tempVy;
        // 少し離す
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const overlap = a.radius + b.radius - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap / 2;
        a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2;
        b.y += ny * overlap / 2;
      }
    }
  }

  // 自動ビーム発射
  if (gameState === GAME_STATE.PLAYING) {
    autoBeamTimer += 1000 / 60;
    if (autoBeamTimer > AUTO_BEAM_INTERVAL) {
      shootBeam();
      autoBeamTimer = 0;
    }
  }
}

// --- 入力でゲーム開始 ---
canvas.addEventListener('click', () => {
  if (gameState === GAME_STATE.READY) {
    startGame();
  } else if (gameState === GAME_STATE.GAMEOVER) {
    resetGame();
  }
});

document.addEventListener('keydown', (e) => {
  if (gameState === GAME_STATE.READY && (e.code === 'Space' || e.code === 'Enter')) {
    startGame();
  } else if (gameState === GAME_STATE.GAMEOVER && (e.code === 'Space' || e.code === 'Enter')) {
    resetGame();
  }
  // ←→/A/Dのみ移動
  if (gameState === GAME_STATE.PLAYING) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') player.moveLeft = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') player.moveRight = true;
  }
});

document.addEventListener('keyup', (e) => {
  if (gameState === GAME_STATE.PLAYING) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') player.moveLeft = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') player.moveRight = false;
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (gameState === GAME_STATE.PLAYING) {
    shootBeam();
  }
});

document.addEventListener('touchstart', (e) => {
  if (gameState === GAME_STATE.PLAYING) {
    shootBeam();
  }
});

function startGame() {
  gameState = GAME_STATE.PLAYING;
  startTime = performance.now();
  score = 0;
  // 今後: プレイヤー・障害物・ビーム初期化
  player = new Player();
  beams = [];
  obstacles = [];
  obstacleTimer = 0;
  nextObstacleInterval = 2000;
  autoBeamTimer = 0;
  if (isMobile()) createMobileControls();
  else removeMobileControls();
}

function resetGame() {
  gameState = GAME_STATE.READY;
  score = 0;
  // 今後: ゲーム状態リセット
  removeMobileControls();
}

// --- 画面リサイズ時にコントロール調整 ---
window.addEventListener('resize', () => {
  if (gameState === GAME_STATE.PLAYING && isMobile()) createMobileControls();
  else removeMobileControls();
});

// ゲームループ開始
requestAnimationFrame(gameLoop); 