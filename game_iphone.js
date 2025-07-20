const gameScreen = document.getElementById('gameCanvas');
const scoreDisplay = document.getElementById('scoreDisplay');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreDisplay = document.getElementById('finalScore');
const highScoreDisplay = document.getElementById('highScore');
const restartButton = document.getElementById('restartButton');

const WIDTH = 60;
const HEIGHT = 15;
const PLATFORM_BASE_Y = HEIGHT - 4; // プラットフォームの基準となるY座標

let player;
let platforms = [];
let items = [];
let obstacles = [];
let particles = [];
let backgroundObjects = [];
let score = 0;
let highScore = localStorage.getItem('skyhighRunnerHighScore') || 0;
let gameSpeed;
let gameOver = false;
let gameStarted = false; // ゲームが開始されたかどうかのフラグ
let comboCounter = 0;
let invincibleTimer = 0;

const GRAVITY = 0.06; // 重力を下げてふわっとさせる

class Player {
    constructor() {
        this.x = 10;
        this.y = PLATFORM_BASE_Y - 1; // プラットフォームの少し上に配置
        this.width = 1;
        this.height = 1;
        this.velocityY = 0;
        this.isJumping = false; // 空中にいるかどうかの判定
        this.jumpsLeft = 2; // ジャンプの残り回数
        this.jumpStrength = -0.8; // 1段目のジャンプ力
        this.secondJumpStrength = -0.6; // 2段目のジャンプ力

        this.runFrames = ['P', 'o', 'O'];
        this.animationFrame = 0;
        this.frameCounter = 0;
    }

    draw() {
        if (this.isJumping) return 'P';
        this.frameCounter++;
        if (this.frameCounter % 10 === 0) {
            this.animationFrame = (this.animationFrame + 1) % this.runFrames.length;
        }
        return this.runFrames[this.animationFrame];
    }

    update() {
        this.y += this.velocityY;
        this.velocityY += GRAVITY;

        // プレイヤーが画面下部に落ちた場合の処理は、メインのupdate関数で処理される
        // ここでは重力による落下のみを処理
    }

    jump() {
        if (this.jumpsLeft > 0) {
            if (this.jumpsLeft === 2) { // 1段目のジャンプ
                this.velocityY = this.jumpStrength;
            } else { // 2段目のジャンプ
                this.velocityY = this.secondJumpStrength;
            }
            this.isJumping = true;
            this.jumpsLeft--;
            createParticles(this.x, this.y + 1, 3, '*');
        }
    }

    fastFall() {
        if (this.isJumping) {
            this.velocityY = Math.max(this.velocityY, 0.5);
        }
    }
}

class Platform {
    constructor(x, y, width) {
        this.x = x;
        this.y = y;
        this.width = width;
    }

    draw() {
        return '=';
    }

    update() {
        this.x -= gameSpeed;
    }
}

class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
    }

    draw() {
        switch (this.type) {
            case 'coin': return 'o';
            case 'gem': return '*';
            case 'speedUp': return '>';
            case 'speedDown': return '<';
            case 'invincible': return 'I';
            default: return '?';
        }
    }

    update() {
        this.x -= gameSpeed;
    }
}

class Obstacle {
    constructor(x, y, speedX = 0, speedY = 0) {
        this.x = x;
        this.y = y;
        this.speedX = speedX;
        this.speedY = speedY;
        this.initialY = y;
    }

    draw() {
        return 'X';
    }

    update() {
        this.x -= gameSpeed;
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.speedY !== 0 && (this.y < this.initialY - 2 || this.y > this.initialY)) {
            this.speedY *= -1;
        }
    }
}

class Particle {
    constructor(x, y, char, life) {
        this.x = x;
        this.y = y;
        this.char = char;
        this.life = life;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
    }

    draw() {
        return this.char;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
}

class BackgroundObject {
    constructor(x, y, char, speed) {
        this.x = x;
        this.y = y;
        this.char = char;
        this.speed = speed;
    }

    draw() {
        return this.char;
    }

    update() {
        this.x -= this.speed;
    }
}

function createParticles(x, y, count, char) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, char, Math.random() * 10 + 5));
    }
}

function init() {
    player = new Player();
    platforms = [new Platform(0, PLATFORM_BASE_Y, WIDTH)]; // 初期プラットフォームのY座標を調整
    items = [];
    obstacles = [];
    particles = [];
    backgroundObjects = [];
    score = 0;
    gameSpeed = 0.6;
    gameOver = false;
    gameStarted = false; // ゲーム開始前はfalse
    comboCounter = 0;
    invincibleTimer = 0;

    for (let i = 0; i < 5; i++) {
        backgroundObjects.push(new BackgroundObject(Math.random() * WIDTH, Math.random() * (HEIGHT - 10), '~', 0.02));
        backgroundObjects.push(new BackgroundObject(Math.random() * WIDTH, HEIGHT - 2 - Math.random() * 3, '^', 0.01));
    }

    gameOverScreen.classList.add('hidden');
    scoreDisplay.textContent = `Score: ${score}`;
    highScoreDisplay.textContent = `High Score: ${highScore}`;

    // ゲーム説明画面を表示
    drawExplanationScreen();
}

function drawExplanationScreen() {
    const grid = Array(HEIGHT).fill(null).map(() => Array(WIDTH).fill(' '));

    const messages = [
        "Press SPACE or Tap to Jump",
        "ArrowDown or Left Tap to Fast Fall",
        "",
        "P: Player",
        "X: Obstacle",
        "o: Coin (+10 Score)",
        "*: Gem (+100 Score)",
        ">: Speed Up",
        "<: Speed Down",
        "I: Invincible",
        "",
        "Tap or Press any key to Start!"
    ];

    let startRow = Math.floor((HEIGHT - messages.length) / 2);
    if (startRow < 0) startRow = 0;

    messages.forEach((msg, index) => {
        const row = startRow + index;
        const startCol = Math.floor((WIDTH - msg.length) / 2);
        if (row >= 0 && row < HEIGHT) {
            for (let i = 0; i < msg.length; i++) {
                const col = startCol + i;
                if (col >= 0 && col < WIDTH) {
                    grid[row][col] = msg[i];
                }
            }
        }
    });

    gameScreen.textContent = grid.map(row => row.join('')).join('\n');
}

function startGame() {
    if (gameStarted) return; // 既に開始済みなら何もしない
    gameStarted = true;
    gameLoop(); // ゲームループを開始
}

function generateContent() {
    const lastPlatform = platforms[platforms.length - 1];
    if (lastPlatform.x + lastPlatform.width < WIDTH + 20) {
        const width = Math.floor(Math.random() * 15) + 8;
        const x = lastPlatform.x + lastPlatform.width + Math.floor(Math.random() * 8) + 5;
        const y = PLATFORM_BASE_Y - Math.floor(Math.random() * 2); // プラットフォームのY座標を調整
        platforms.push(new Platform(x, y, width));

        if (Math.random() < 0.4) {
            let itemType = 'coin';
            const rand = Math.random();
            if (rand < 0.1) itemType = 'gem';
            else if (rand < 0.15) itemType = 'speedUp';
            else if (rand < 0.2) itemType = 'speedDown';
            else if (rand < 0.25) itemType = 'invincible';
            items.push(new Item(x + Math.floor(Math.random() * width), y - 1, itemType));
        }

        if (Math.random() < 0.3) {
            const speedY = Math.random() < 0.3 ? (Math.random() - 0.5) * 0.1 : 0;
            obstacles.push(new Obstacle(x + Math.floor(Math.random() * width), y - 1, 0, speedY));
        }
    }

    if (Math.random() < 0.1) {
        backgroundObjects.push(new BackgroundObject(WIDTH, Math.random() * (HEIGHT - 10), '~', 0.02));
    }
    if (Math.random() < 0.05) {
        backgroundObjects.push(new BackgroundObject(WIDTH, HEIGHT - 2 - Math.random() * 3, '^', 0.01));
    }
}

function gameLoop() {
    if (gameOver || !gameStarted) return; // ゲームが開始されていない場合は更新しない
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    player.update();
    platforms.forEach(p => p.update());
    items.forEach(i => i.update());
    obstacles.forEach(o => o.update());
    particles.forEach(p => p.update());
    backgroundObjects.forEach(b => b.update());

    if (invincibleTimer > 0) invincibleTimer--;

    let onPlatform = false;
    platforms.forEach(p => {
        if (player.x + player.width > p.x && player.x < p.x + p.width &&
            player.y + player.height >= p.y && player.y + player.height <= p.y + 1 &&
            player.velocityY >= 0) {
            
            player.y = p.y - player.height;
            player.velocityY = 0;
            if (player.isJumping) {
                createParticles(player.x, player.y + player.height, 5, '.');
            }
            player.isJumping = false;
            player.jumpsLeft = 2; // ジャンプ回数をリセット
            onPlatform = true;
            comboCounter = 0;
        }
    });

    if (player.y >= HEIGHT - 1 && !onPlatform) { // ゲームオーバー条件を画面最下部に変更
        endGame();
    }

    items.forEach((item, index) => {
        if (Math.round(player.x) === Math.round(item.x) && Math.round(player.y) === Math.round(item.y)) {
            comboCounter++;
            let comboBonus = Math.floor(comboCounter / 5) * 100;
            if (item.type === 'coin') score += 10 + comboBonus;
            else if (item.type === 'gem') score += 100 + comboBonus;
            else if (item.type === 'speedUp') gameSpeed *= 1.2;
            else if (item.type === 'speedDown') gameSpeed *= 0.8;
            else if (item.type === 'invincible') invincibleTimer = 300;
            items.splice(index, 1);
        }
    });

    if (invincibleTimer <= 0) {
        obstacles.forEach(obstacle => {
            if (Math.round(player.x) === Math.round(obstacle.x) && Math.round(player.y) === Math.round(obstacle.y)) {
                endGame();
            }
        });
    }

    platforms = platforms.filter(p => p.x + p.width > 0);
    items = items.filter(i => i.x > 0);
    obstacles = obstacles.filter(o => o.x > 0);
    particles = particles.filter(p => p.life > 0);
    backgroundObjects = backgroundObjects.filter(b => b.x > -1);

    generateContent();
    scoreDisplay.textContent = `Score: ${score} Combo: ${comboCounter}`;
    if (invincibleTimer > 0) {
        scoreDisplay.textContent += ` Invincible: ${Math.ceil(invincibleTimer / 60)}s`;
    }
}

function draw() {
    const grid = Array(HEIGHT).fill(null).map(() => Array(WIDTH).fill(' '));

    backgroundObjects.forEach(b => {
        const x = Math.round(b.x);
        const y = Math.round(b.y);
        if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            grid[y][x] = b.draw();
        }
    });

    platforms.forEach(p => {
        for (let i = 0; i < p.width; i++) {
            const x = Math.round(p.x) + i;
            if (x >= 0 && x < WIDTH) {
                grid[Math.round(p.y)][x] = p.draw();
            }
        }
    });

    items.forEach(i => {
        const x = Math.round(i.x);
        const y = Math.round(i.y);
        if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            grid[y][x] = i.draw();
        }
    });

    obstacles.forEach(o => {
        const x = Math.round(o.x);
        const y = Math.round(o.y);
        if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            grid[y][x] = invincibleTimer > 0 ? '!' : o.draw();
        }
    });

    particles.forEach(p => {
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
            grid[y][x] = p.draw();
        }
    });

    const playerX = Math.round(player.x);
    const playerY = Math.round(player.y);
    if (playerX >= 0 && playerX < WIDTH && playerY >= 0 && playerY < HEIGHT) {
        grid[playerY][playerX] = invincibleTimer > 0 && invincibleTimer % 10 < 5 ? 'P' : player.draw();
    }

    gameScreen.textContent = grid.map(row => row.join('')).join('\n');
}

function endGame() {
    gameOver = true;
    finalScoreDisplay.textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('skyhighRunnerHighScore', highScore);
    }
    highScoreDisplay.textContent = highScore;
    gameOverScreen.classList.remove('hidden');
}

document.addEventListener('keydown', (e) => {
    if (gameOver) return;
    if (!gameStarted) { // ゲーム開始前ならゲームを開始
        startGame();
        return;
    }
    if (e.code === 'Space') {
        player.jump();
    }
    if (e.code === 'ArrowDown') {
        player.fastFall();
    }
});

document.addEventListener('touchstart', (e) => {
    if (gameOver) return;
    if (!gameStarted) { // ゲーム開始前ならゲームを開始
        startGame();
        return;
    }
});

restartButton.addEventListener('click', init);

init();

// Touch controls for iPhone
const touchJumpArea = document.getElementById('touchJumpArea');
const touchFallArea = document.getElementById('touchFallArea');

if (touchJumpArea) {
    touchJumpArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameOver) return;
        if (!gameStarted) { // ゲーム開始前ならゲームを開始
            startGame();
            return;
        }
        player.jump();
    });
}

if (touchFallArea) {
    touchFallArea.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameOver) return;
        if (!gameStarted) { // ゲーム開始前ならゲームを開始
            startGame();
            return;
        }
        player.fastFall();
    });
}
