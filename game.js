const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const restartButton = document.getElementById('restartButton');

// Game settings
const canvasWidth = 250;
const canvasHeight = 250;

canvas.width = canvasWidth;
canvas.height = canvasHeight;

let player;
let obstacles = [];
let specialWalls = [];
let score = 0;
let gameOver = false;
let gameLoopId;
let obstacleInterval;
let specialWallInterval;
let keys = {};
let touchStartX = null;
let touchStartY = null;

function init() {
    player = {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        radius: 6,
        size: 10,
        speed: 3
    };

    obstacles = [];
    specialWalls = [];
    score = 0;
    gameOver = false;
    keys = {};
    touchStartX = null;
    touchStartY = null;

    scoreElement.textContent = 'Score: 0';
    gameOverElement.style.display = 'none';

    if (obstacleInterval) clearInterval(obstacleInterval);
    if (specialWallInterval) clearInterval(specialWallInterval);

    spawnObstacle();

    obstacleInterval = setInterval(spawnObstacle, 10000);
    specialWallInterval = setInterval(triggerSpecialWalls, 30000);
}

function gameLoop() {
    if (gameOver) {
        cancelAnimationFrame(gameLoopId);
        return;
    }
    update();
    draw();
    gameLoopId = requestAnimationFrame(gameLoop);
}

function triggerSpecialWalls() {
    const count = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < count; i++) {
        spawnSpecialWall();
    }
}

function update() {
    // Player keyboard movement
    if (keys['w'] || keys['ArrowUp']) player.y -= player.speed;
    if (keys['s'] || keys['ArrowDown']) player.y += player.speed;
    if (keys['a'] || keys['ArrowLeft']) player.x -= player.speed;
    if (keys['d'] || keys['ArrowRight']) player.x += player.speed;

    // Player-outer wall collision
    if (player.x - player.radius < 0) player.x = player.radius;
    if (player.x + player.radius > canvasWidth) player.x = canvasWidth - player.radius;
    if (player.y - player.radius < 0) player.y = player.radius;
    if (player.y + player.radius > canvasHeight) player.y = canvasHeight - player.radius;

    // Obstacle movement and collision
    obstacles.forEach(o => {
        if (o.trapped) {
            o.x += o.dx;
            o.y += o.dy;
            const wall = o.trappedBy;
            if (o.x - o.radius < wall.x || o.x + o.radius > wall.x + wall.width) { o.dx *= -1; o.x += o.dx; }
            if (o.y - o.radius < wall.y || o.y + o.radius > wall.y + wall.height) { o.dy *= -1; o.y += o.dy; }
        } else {
            o.x += o.dx;
            o.y += o.dy;
            if (o.x - o.radius < 0 || o.x + o.radius > canvasWidth) o.dx *= -1;
            if (o.y - o.radius < 0 || o.y + o.radius > canvasHeight) o.dy *= -1;
            specialWalls.forEach(sw => {
                if (o.x + o.radius > sw.x && o.x - o.radius < sw.x + sw.width && o.y > sw.y && o.y < sw.y + sw.height) { o.dx *= -1; o.x += o.dx * 2; }
                if (o.y + o.radius > sw.y && o.y - o.radius < sw.y + sw.height && o.x > sw.x && o.x < sw.x + sw.width) { o.dy *= -1; o.y += o.dy * 2; }
            });
        }
    });

    score++;
    scoreElement.textContent = `Score: ${score}`;

    checkCollisions();
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw player
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const topCurveHeight = player.size * 0.3;
    ctx.moveTo(player.x, player.y + topCurveHeight);
    ctx.bezierCurveTo(player.x, player.y, player.x - player.size / 2, player.y, player.x - player.size / 2, player.y + topCurveHeight);
    ctx.bezierCurveTo(player.x - player.size / 2, player.y + (player.size + topCurveHeight) / 2, player.x, player.y + (player.size + topCurveHeight) / 2, player.x, player.y + player.size);
    ctx.bezierCurveTo(player.x, player.y + (player.size + topCurveHeight) / 2, player.x + player.size / 2, player.y + (player.size + topCurveHeight) / 2, player.x + player.size / 2, player.y + topCurveHeight);
    ctx.bezierCurveTo(player.x + player.size / 2, player.y, player.x, player.y, player.x, player.y + topCurveHeight);
    ctx.closePath();
    ctx.stroke();

    // Draw obstacles
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    obstacles.forEach(o => { ctx.beginPath(); ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2); ctx.stroke(); });

    // Draw special walls
    specialWalls.forEach(sw => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sw.x, sw.y, sw.width, sw.height); });
}

// --- Event Listeners ---

restartButton.addEventListener('click', () => {
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    init();
    gameLoop();
});

// Keyboard listeners
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

// Touch listeners
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (touchStartX === null) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    
    // Move player based on drag distance
    player.x += currentX - touchStartX;
    player.y += currentY - touchStartY;
    
    // Update start position for next move event
    touchStartX = currentX;
    touchStartY = currentY;
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touchStartX = null;
    touchStartY = null;
});

// --- Spawning Functions ---

function spawnObstacle() {
    let x, y, radius = 4;
    do {
        x = Math.random() * (canvasWidth - radius * 2) + radius;
        y = Math.random() * (canvasHeight - radius * 2) + radius;
    } while (isSpawningOnSomething(x, y, radius));

    const angle = Math.random() * 2 * Math.PI;
    obstacles.push({ x, y, radius, dx: Math.cos(angle) * 2, dy: Math.sin(angle) * 2, trapped: false, trappedBy: null });
}

function spawnSpecialWall() {
    let width = 50, height = 50;
    let x, y;
    let attempts = 0;
    do {
        x = Math.random() * (canvasWidth - width);
        y = Math.random() * (canvasHeight - height);
        attempts++;
        if (attempts > 50) return;
    } while (isSpawningOnSomething(x, y, 0, { x, y, width, height }));

    const wall = { x, y, width, height, trappedObstacles: [] };

    obstacles.forEach(o => {
        if (!o.trapped && o.x > wall.x && o.x < wall.x + wall.width && o.y > wall.y && o.y < wall.y + wall.height) {
            o.trapped = true;
            o.trappedBy = wall;
            wall.trappedObstacles.push(o);
        }
    });

    specialWalls.push(wall);

    setTimeout(() => {
        wall.trappedObstacles.forEach(o => { o.trapped = false; o.trappedBy = null; });
        specialWalls = specialWalls.filter(sw => sw !== wall);
    }, 10000);
}

// --- Collision and Utility Functions ---

function isSpawningOnSomething(x, y, radius, rect) {
    const buffer = 20;
    const distToPlayer = Math.hypot(x - player.x, y - player.y);
    if (distToPlayer < (radius || 0) + player.radius + buffer) return true;

    for (const o of obstacles) {
        const distToObstacle = Math.hypot(x - o.x, y - o.y);
        if (distToObstacle < (radius || 0) + o.radius) return true;
    }

    for (const sw of specialWalls) {
        if (rect) {
            if (x < sw.x + sw.width && x + rect.width > sw.x && y < sw.y + sw.height && y + rect.height > sw.y) return true;
        } else {
            if (x > sw.x - radius && x < sw.x + sw.width + radius && y > sw.y - radius && y < sw.y + sw.height + radius) return true;
        }
    }
    return false;
}

function checkCollisions() {
    // Player with obstacles
    for (const o of obstacles) {
        const dist = Math.hypot(player.x - o.x, player.y - o.y);
        if (dist < player.radius + o.radius) { endGame(); return; }
    }

    // Player with special walls
    for (const sw of specialWalls) {
        let testX = player.x, testY = player.y;
        if (player.x < sw.x) testX = sw.x;
        else if (player.x > sw.x + sw.width) testX = sw.x + sw.width;
        if (player.y < sw.y) testY = sw.y;
        else if (player.y > sw.y + sw.height) testY = sw.y + sw.height;

        const dist = Math.hypot(player.x - testX, player.y - testY);
        if (dist < player.radius) {
            const overlapX = player.radius - Math.abs(player.x - testX);
            const overlapY = player.radius - Math.abs(player.y - testY);
            if (player.x < sw.x) player.x -= overlapX;
            else if (player.x > sw.x + sw.width) player.x += overlapX;
            if (player.y < sw.y) player.y -= overlapY;
            else if (player.y > sw.y + sw.height) player.y += overlapY;
        }
    }
}

function endGame() {
    gameOver = true;
    finalScoreElement.textContent = score;
    gameOverElement.style.display = 'block';
    clearInterval(obstacleInterval);
    clearInterval(specialWallInterval);
}

// Initial load
init();
gameLoop();
