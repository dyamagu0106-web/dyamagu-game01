const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Images
const playerImg = new Image();
playerImg.src = 'images/player.png';
const alienImages = [];
for (let i = 1; i <= 12; i++) {
    const img = new Image();
    img.src = `images/alien${i}.png`;
    alienImages.push(img);
}
const bossImg = new Image();
bossImg.src = 'images/boss.png';

// Sounds
const shootSound = new Audio('sounds/shoot.mp3');
const explosionSound = new Audio('sounds/explosion.mp3');
const gameoverSound = new Audio('sounds/gameover.mp3');
const openingBgm = new Audio('sounds/opening.mp3');
openingBgm.loop = true;
const gameBgm = new Audio('sounds/bgm.mp3');
gameBgm.loop = true;
const bossBgm = new Audio('sounds/boss.mp3');
bossBgm.loop = true;
const fanfareSound = new Audio('sounds/fanfare.mp3');

// Game state
let gameState = 'start'; // 'start', 'playing', 'gameover', 'stage_clear', 'paused', 'respawning'
let stage = 1;

// Input state
const keys = {};
let shootButtonPressed = false;
const shootCooldown = 150; // ms - Initial rate allows 4 bullets on screen
let lastShotTime = 0;
let gamepadStartPressed = false; // Track gamepad start button state

// Player
let lives = 3; // 残機数
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 60,
    width: 50,
    height: 50,
    speed: 4,
    dx: 0,
    dy: 0
};

// Power-up system
let powerUpSpeed = 0; // 0-3 levels
let powerUpFireRate = 0; // 0-7 levels
let powerUpWideShot = 0; // 0-3 levels
const powerUps = []; // Array to hold power-up capsules

// Bullets
const bullets = [];
const bulletSpeed = 7;

// Enemy Bullets
const enemyBullets = [];
const enemyBulletSpeed = 5;

// Stars for background
const stars = [];
const numStars = 100;
const starSpeed = 1;

function createStars() {
    for (let i = 0; i < numStars; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.5,
            alpha: Math.random()
        });
    }
}

// Explosions
const explosions = [];

// Score
let score = 0;
let enemiesDefeated = 0;

// Boss
let boss = null;
let bossActive = false;

// Aliens
const aliens = [];
const alienWidth = 40;
const alienHeight = 30;
let alienSpeed = 2; // Base speed
let alienSpawnTimer = 100;
let availableEnemies = [0, 1, 2]; // Initial enemy types
const activeSquads = new Map(); // Track active squads for power-up drops

// Draw stars
function drawStars() {
    ctx.save();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// Draw player
function drawPlayer() {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
}

// Draw bullets
function drawBullets() {
    for (let i = 0; i < bullets.length; i++) {
        ctx.fillStyle = '#ffff99'; // Light yellow color
        ctx.fillRect(bullets[i].x, bullets[i].y, 5, 10);
    }
}

// Draw aliens
function drawAliens() {
    for (let i = 0; i < aliens.length; i++) {
        const alien = aliens[i];
        const img = alienImages[alien.imgIndex];
        if (alien.type === 'squad') {
            ctx.filter = 'hue-rotate(120deg) saturate(5)'; // Make squad aliens vibrant green
        }
        ctx.drawImage(img, alien.x, alien.y, alien.width, alien.height);
        ctx.filter = 'none'; // Reset filter
    }
}

// Draw enemy bullets
function drawEnemyBullets() {
    for (let i = 0; i < enemyBullets.length; i++) {
        const bullet = enemyBullets[i];
        if (bullet.isHoming) {
            ctx.fillStyle = '#ffa500'; // Orange color for homing bullets
        } else {
            ctx.fillStyle = '#f00'; // Red color for enemy bullets
        }
        ctx.fillRect(bullet.x, bullet.y, 5, 10);
    }
}

// Draw power-ups
function drawPowerUps() {
    for (let i = 0; i < powerUps.length; i++) {
        const powerUp = powerUps[i];
        
        // Draw power-up capsule with different colors based on type
        if (powerUp.type === 'speed') {
            ctx.fillStyle = '#0f0'; // Green for speed
        } else if (powerUp.type === 'fireRate') {
            ctx.fillStyle = '#00f'; // Blue for fire rate
        } else if (powerUp.type === 'wideShot') {
            ctx.fillStyle = '#f0f'; // Magenta for wide shot
        }
        
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        
        // Draw border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        
        // Draw letter indicator
        ctx.fillStyle = '#fff';
        ctx.font = "12px 'Press Start 2P'";
        ctx.textAlign = 'center';
        const centerX = powerUp.x + powerUp.width / 2;
        const centerY = powerUp.y + powerUp.height / 2 + 4;
        
        if (powerUp.type === 'speed') {
            ctx.fillText('S', centerX, centerY);
        } else if (powerUp.type === 'fireRate') {
            ctx.fillText('R', centerX, centerY);
        } else if (powerUp.type === 'wideShot') {
            ctx.fillText('W', centerX, centerY);
        }
    }
}

function drawBoss() {
    if (bossActive && boss) {
        ctx.drawImage(bossImg, boss.x, boss.y, boss.width, boss.height);
    }
}

// Draw explosions
function drawExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        ctx.fillStyle = `rgba(255, 255, 0, ${explosion.alpha})`;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
        ctx.fill();
        explosion.alpha -= 0.05;
        if (explosion.alpha <= 0) {
            explosions.splice(i, 1);
        }
    }
}

// Move stars
function moveStars() {
    // Double speed on stages that are multiples of 4
    const currentStarSpeed = (stage % 4 === 0) ? starSpeed * 2 : starSpeed;
    
    for (let i = 0; i < stars.length; i++) {
        stars[i].y += currentStarSpeed;
        if (stars[i].y > canvas.height) {
            stars[i].y = 0;
            stars[i].x = Math.random() * canvas.width;
        }
    }
}

// Move player
function movePlayer() {
    // Apply speed power-up (base speed 5, +1 per level)
    const currentSpeed = player.speed + powerUpSpeed;
    player.x += player.dx * (currentSpeed / player.speed);
    player.y += player.dy * (currentSpeed / player.speed);

    // Wall detection
    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }
    if (player.y < 0) {
        player.y = 0;
    }
    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
    }
}

// Draw score
function drawScore() {
    ctx.font = "16px 'Press Start 2P'";
    ctx.fillStyle = '#0f0';
    ctx.textAlign = 'left';
    ctx.fillText(`1UP > ${String(score).padStart(6, '0')}`, 8, 20);
    ctx.fillText(`LIVES: ${lives}`, 8, 40); // 残機表示
    ctx.textAlign = 'center';
    ctx.fillText(`HI > 000000`, canvas.width / 2, 20);
    ctx.textAlign = 'right';
    ctx.fillText(`STAGE ${stage}`, canvas.width - 8, 20);
    ctx.textAlign = 'left'; // Reset alignment
}

// Move bullets
function moveBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        if (bullet.dx !== undefined && bullet.dy !== undefined) {
            // Directional bullets (wide shot)
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;
        } else {
            // Standard bullets - use bullet's speed if available, otherwise default
            const speed = bullet.speed || bulletSpeed;
            bullet.y -= speed;
        }
        
        // Remove bullets that are off-screen
        if (bullet.y < -10 || bullet.x < -10 || bullet.x > canvas.width + 10) {
            bullets.splice(i, 1);
        }
    }
}

// Move power-ups
function movePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].y += powerUps[i].dy;
        
        // Remove power-ups that fall off screen
        if (powerUps[i].y > canvas.height) {
            powerUps.splice(i, 1);
        }
    }
}

// Move enemy bullets
function moveEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        
        if (bullet.isHoming) {
            // Decrease homing timer
            if (bullet.homingTimer > 0) {
                bullet.homingTimer--;
                
                // Homing bullets - continuously track player while timer is active
                const playerCenterX = player.x + player.width / 2;
                const playerCenterY = player.y + player.height / 2;
                const dx = playerCenterX - bullet.x;
                const dy = playerCenterY - bullet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    const homingSpeed = enemyBulletSpeed;
                    const turnRate = 0.1; // How quickly the bullet can change direction
                    
                    // Calculate desired velocity
                    const desiredDx = (dx / distance) * homingSpeed;
                    const desiredDy = (dy / distance) * homingSpeed;
                    
                    // Gradually adjust current velocity toward desired velocity
                    bullet.dx += (desiredDx - bullet.dx) * turnRate;
                    bullet.dy += (desiredDy - bullet.dy) * turnRate;
                }
            } else {
                // Timer expired, convert to normal bullet
                bullet.isHoming = false;
            }
            
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;
        } else if (bullet.dx !== undefined && bullet.dy !== undefined) {
            // Directional bullets (fan-shaped bullets)
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;
        } else {
            // Standard bullets
            bullet.y += enemyBulletSpeed;
        }
        
        // Remove bullets that are off-screen
        if (bullet.y > canvas.height || bullet.y < -10 || 
            bullet.x < -10 || bullet.x > canvas.width + 10) {
            enemyBullets.splice(i, 1);
        }
    }
}

function applyAlienMovement(alien) {
    // Store original position if not stored
    if (alien.initialX === undefined) {
        alien.initialX = alien.x;
        alien.initialY = alien.y;
        alien.angle = 0; // For wave/circular movements
    }

    const pattern = alien.movePattern;

    // Pattern-based movement
    switch (pattern) {
        case 0: // Straight down
            alien.y += alienSpeed;
            break;
        case 1: // Straight down with horizontal movement
            alien.y += alienSpeed;
            alien.x += alien.dx;
            if (alien.x < 0 || alien.x + alien.width > canvas.width) alien.dx *= -1;
            break;
        case 2: // Sine wave
            alien.y += alienSpeed;
            alien.x = alien.initialX + Math.sin(alien.y * 0.05) * 75;
            break;
        case 3: // Diagonal bounce
            alien.x += alien.dx;
            alien.y += alienSpeed * 0.75;
            if (alien.x < 0 || alien.x + alien.width > canvas.width) alien.dx *= -1;
            break;
        case 4: // Pause and go
            if (alien.y > 100 && alien.y < 110) {
                // Pauses briefly
            } else {
                alien.y += alienSpeed;
            }
            break;
        case 5: // Homing (gentle)
            if (player.x > alien.x) alien.x += 1;
            else alien.x -= 1;
            alien.y += alienSpeed * 0.9;
            break;
        case 6: // Fast dive
            alien.y += alienSpeed * 2.5;
            break;
        case 7: // Circle
            alien.angle += 0.05;
            alien.x = alien.initialX + Math.cos(alien.angle) * 80;
            alien.y += alienSpeed * 0.5;
            break;
        case 8: // Figure-eight
             alien.angle += 0.05;
             alien.x = alien.initialX + Math.sin(alien.angle) * 100;
             alien.y = alien.initialY + (alien.angle * 20) + Math.cos(alien.angle * 0.5) * 50;
             break;
        case 9: // Wall bouncing
            alien.x += alien.dx * 2;
            alien.y += alien.dy * 2;
            if (alien.x < 0 || alien.x + alien.width > canvas.width) alien.dx *= -1;
            if (alien.y < 0 || alien.y + alien.height > canvas.height) alien.dy *= -1;
            break;
        case 10: // Quick horizontal dashes
            alien.y += alienSpeed;
            if (Math.floor(alien.y) % 100 < 1) {
                 alien.dx = (Math.random() < 0.5 ? -1 : 1) * (alienSpeed * 3);
            }
            alien.x += alien.dx;
            if (alien.x < 0 || alien.x + alien.width > canvas.width) alien.dx = 0;
            break;
        case 11: // Slow and steady, aims more
             alien.y += alienSpeed * 0.7;
             if (Math.abs(player.x - alien.x) > 10) {
                 alien.x += Math.sign(player.x - alien.x) * 1;
             }
             break;
        default: // Default to straight down
            alien.y += alienSpeed;
            break;
    }
}

// Move aliens
function moveAliens() {
    for (let i = aliens.length - 1; i >= 0; i--) {
        const alien = aliens[i];

        if (alien.type === 'squad' && !alien.isLeader) {
            // --- Follower Movement ---
            if (alien.leader && aliens.includes(alien.leader)) {
                const targetX = alien.leader.x;
                const targetY = alien.leader.y;
                const lerpFactor = 0.08;
                alien.x += (targetX - alien.x) * lerpFactor;
                alien.y += (targetY - alien.y) * lerpFactor;
            } else {
                // Leader is gone, find a new leader from the same original squad
                const originalLeader = alien.leader;
                const squadMates = aliens.filter(a => a.leader === originalLeader && a !== alien);

                if (squadMates.length > 0) {
                    const newLeader = squadMates[0];
                    newLeader.isLeader = true;
                    newLeader.dx = originalLeader.dx; // Inherit properties
                    newLeader.dy = originalLeader.dy;
                    newLeader.movePattern = originalLeader.movePattern;
                    newLeader.initialX = newLeader.x; // Reset movement pattern origin
                    newLeader.initialY = newLeader.y;
                    newLeader.angle = 0;

                    // Update remaining followers to follow the new leader
                    for (const mate of squadMates) {
                        if (mate !== newLeader) {
                            mate.leader = newLeader;
                        }
                    }
                }
                 // This alien now becomes a normal alien
                 alien.type = 'normal';
                 alien.movePattern = alien.imgIndex;
                 alien.dx = (Math.random() < 0.5 ? -1 : 1) * (alienSpeed / 2);
                 alien.dy = alienSpeed;
            }
        } else {
             applyAlienMovement(alien);
        }

        // --- Common logic for all aliens ---
        // Firing
        if (Math.random() < 0.005 && alien.y > 0) {
            enemyBullets.push({
                x: alien.x + alien.width / 2 - 2.5,
                y: alien.y + alien.height
            });
        }

        // Off-screen removal
        if (alien.y > canvas.height) {
            aliens.splice(i, 1);
        }
    }
}

function moveBoss() {
    if (!bossActive || !boss) return;

    // Initial descent
    if (boss.y < 50) {
        boss.y += 1;
        return;
    }

    // Stage 1 boss has simple movement
    if (stage < 2) {
        boss.x += boss.dx;
        if (boss.x < 0 || boss.x + boss.width > canvas.width) {
            boss.dx *= -1;
        }
        
        // Stage 1 boss firing
        boss.fireCooldown--;
        if (boss.fireCooldown <= 0) {
            enemyBullets.push({ x: boss.x + boss.width / 2 - 2.5, y: boss.y + boss.height });
            boss.fireCooldown = boss.fireRate;
        }
        return;
    }

    // Handle dive attack sequence
    if (boss.isDiving) {
        if (boss.diveCooldown > 0) {
            boss.diveCooldown--;
            return; // Pause before diving
        }
        
        if (!boss.isReturning) {
            // Dive down
            boss.y += boss.diveSpeed;
            if (boss.y > canvas.height - 100) {
                boss.isReturning = true;
                boss.diveSpeed *= -1; // Reverse direction
            }
        } else {
            // Return to original position
            boss.y += boss.diveSpeed;
            if (boss.y <= boss.originalY) {
                // Attack finished
                boss.isDiving = false;
                boss.isReturning = false;
                boss.diveCooldown = 360; // 6秒クールダウン (60fps)
                boss.y = boss.originalY;
            }
        }
        return;
    }

    // Decrease dive cooldown
    if (boss.diveCooldown > 0) {
        boss.diveCooldown--;
    }

    // Random dive attack (only when cooldown is 0)
    if (boss.diveCooldown <= 0 && Math.random() < 0.08) { // Increased probability to 8%
        boss.isDiving = true;
        boss.diveCooldown = 30; // 0.5秒停止 (60fps想定)
        boss.diveSpeed = alienSpeed * 3; // 通常の3倍速
        boss.originalY = boss.y;
    }

    // Normal movement
    boss.x += boss.dx;
    if (boss.x < 0 || boss.x + boss.width > canvas.width) {
        boss.dx *= -1;
    }

    // Firing
    boss.fireCooldown--;
    if (boss.fireCooldown <= 0) {
        // Stage 3+ boss: Add fan-shaped bullets every 4th shot (double speed)
        if (stage >= 3) {
            boss.shotCounter = (boss.shotCounter || 0) + 1;
            if (boss.shotCounter % 4 === 0) {
                // Fan-shaped bullets (half speed, downward direction)
                const fanBulletSpeed = enemyBulletSpeed * 0.5;
                const centerX = boss.x + boss.width / 2;
                const centerY = boss.y + boss.height;
                const angleStep = Math.PI / 6; // 30 degrees
                const numBullets = 5;
                
                for (let i = 0; i < numBullets; i++) {
                    const angle = (i - 2) * angleStep; // Center bullet goes straight down (0°), spread left and right
                    enemyBullets.push({
                        x: centerX - 2.5,
                        y: centerY,
                        dx: Math.sin(angle) * fanBulletSpeed,
                        dy: fanBulletSpeed * Math.cos(angle)
                    });
                }
                
                // Stage 4+ boss: Add homing bullets
                if (stage >= 4) {
                    const playerCenterX = player.x + player.width / 2;
                    const playerCenterY = player.y + player.height / 2;
                    const homingX = boss.x + boss.width / 2;
                    const homingY = boss.y + boss.height;
                    
                    // Calculate direction to player
                    const dx = playerCenterX - homingX;
                    const dy = playerCenterY - homingY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0) {
                        const homingSpeed = enemyBulletSpeed;
                        enemyBullets.push({
                            x: homingX - 2.5,
                            y: homingY,
                            dx: (dx / distance) * homingSpeed,
                            dy: (dy / distance) * homingSpeed,
                            isHoming: true,
                            homingTimer: 120 // 2 seconds at 60fps
                        });
                    }
                }
            } else {
                // Normal attack pattern
                enemyBullets.push({ x: boss.x + boss.width / 2 - 2.5, y: boss.y + boss.height });
                enemyBullets.push({ x: boss.x + 20, y: boss.y + boss.height / 2 });
                enemyBullets.push({ x: boss.x + boss.width - 20, y: boss.y + boss.height / 2 });
            }
        } else {
            // Normal attack pattern for stages 1-2
            enemyBullets.push({ x: boss.x + boss.width / 2 - 2.5, y: boss.y + boss.height });
            enemyBullets.push({ x: boss.x + 20, y: boss.y + boss.height / 2 });
            enemyBullets.push({ x: boss.x + boss.width - 20, y: boss.y + boss.height / 2 });
        }
        boss.fireCooldown = boss.fireRate;
    }
}

function handleGameOver() {
    if (gameState !== 'playing') return;

    // Create explosion at player's position
    explosions.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        radius: 50,
        alpha: 1
    });
    
    // Hide player immediately
    player.y = -200;
    
    lives--;
    
    if (lives <= 0) {
        // Game over
        gameState = 'gameover';
        gameBgm.pause();
        if (bossActive) {
            bossBgm.pause();
        }
        gameoverSound.play();
    } else {
        if (bossActive) {
            // During boss fight, just respawn player without restarting stage
            gameState = 'respawning';
            setTimeout(() => {
                if (gameState === 'respawning') {
                    // Reset player position and clear player bullets only
                    player.x = canvas.width / 2 - 25;
                    player.y = canvas.height - 60;
                    player.dx = 0;
                    player.dy = 0;
                    bullets.length = 0; // Clear player bullets only
                    gameState = 'playing';
                }
            }, 3000); // 3 seconds delay
        } else {
            // Normal stage restart
            gameState = 'respawning';
            setTimeout(() => {
                if (gameState === 'respawning') {
                    restartStage();
                    gameState = 'playing';
                }
            }, 3000); // 3 seconds delay
        }
    }
}

function restartStage() {
    // Clear all enemies and bullets
    aliens.length = 0;
    enemyBullets.length = 0;
    bullets.length = 0;
    explosions.length = 0;
    
    // Reset player position
    player.x = canvas.width / 2 - 25;
    player.y = canvas.height - 60;
    player.dx = 0;
    player.dy = 0;
    
    // Reset spawn timer
    alienSpawnTimer = 100;
    
    // Reset boss state if active
    if (bossActive) {
        bossActive = false;
        boss = null;
        bossBgm.pause();
        gameBgm.play();
    }
}

function handleBossDefeat() {
    score += 5000;
    bossActive = false;
    boss = null;
    bossBgm.pause();
    bossBgm.currentTime = 0;
    fanfareSound.play();
    gameState = 'stage_clear';

    // Create a massive explosion
    for (let i = 0; i < 10; i++) {
        explosions.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 200,
            y: 100 + (Math.random() - 0.5) * 100,
            radius: Math.random() * 50 + 50,
            alpha: 1
        });
    }

    setTimeout(() => {
        startNextStage();
    }, 8000);
}

function startNextStage() {
    stage++;
    enemiesDefeated = 0;
    // Increase difficulty
    alienSpeed = 2 + (stage - 1) * 0.5;
    
    // Set available enemies for this stage (max 3 types)
    availableEnemies = [];
    const baseType = Math.min((stage - 1) * 2, 9); // Ensure we don't exceed available enemy types
    
    for (let i = 0; i < 3; i++) {
        const enemyType = baseType + i;
        if (enemyType < 12) { // Ensure enemy type exists
            availableEnemies.push(enemyType);
        }
    }
    
    // If we don't have 3 types, fill with earlier types
    while (availableEnemies.length < 3 && availableEnemies.length < 12) {
        const fillType = availableEnemies.length;
        if (!availableEnemies.includes(fillType)) {
            availableEnemies.push(fillType);
        } else {
            break;
        }
    }

    // Clear remaining bullets
    enemyBullets.length = 0;
    bullets.length = 0;
    // Restart BGM
    gameBgm.play();
    gameState = 'playing';
}

// Collision detection
function collisionDetection() {
    if (gameState !== 'playing') return;

    // Bullets vs Aliens
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = aliens.length - 1; j >= 0; j--) {
            if (
                bullets[i].x > aliens[j].x &&
                bullets[i].x < aliens[j].x + aliens[j].width &&
                bullets[i].y > aliens[j].y &&
                bullets[i].y < aliens[j].y + aliens[j].height
            ) {
                // Create explosion
                explosions.push({
                    x: aliens[j].x + aliens[j].width / 2,
                    y: aliens[j].y + aliens[j].height / 2,
                    radius: 30,
                    alpha: 1
                });

                const defeatedAlien = aliens[j];
                bullets.splice(i, 1);
                aliens.splice(j, 1);
                score += 100;
                enemiesDefeated++;

                // Check if this alien belongs to a squad
                if (defeatedAlien.squadId && activeSquads.has(defeatedAlien.squadId)) {
                    const squad = activeSquads.get(defeatedAlien.squadId);
                    squad.remainingMembers--;
                    
                    // If entire squad is defeated, spawn power-up
                    if (squad.remainingMembers <= 0) {
                        spawnPowerUp(squad.powerUpPosition.x, squad.powerUpPosition.y);
                        activeSquads.delete(defeatedAlien.squadId);
                    }
                }

                // If a squad leader is defeated, promote a new leader
                if (defeatedAlien.isLeader) {
                    const followers = aliens.filter(a => a.leader === defeatedAlien);
                    if (followers.length > 0) {
                        const newLeader = followers[0];
                        newLeader.isLeader = true;
                        newLeader.dx = defeatedAlien.dx;
                        newLeader.dy = defeatedAlien.dy;
                        newLeader.movePattern = defeatedAlien.movePattern;
                        newLeader.initialX = newLeader.x;
                        newLeader.initialY = newLeader.y;
                        newLeader.angle = 0;

                        // Update the rest of the followers
                        for (const follower of followers) {
                            if (follower !== newLeader) {
                                follower.leader = newLeader;
                            }
                        }
                    }
                }
                explosionSound.play();
                break;
            }
        }
    }

    // Bullets vs Boss
    if (bossActive && boss) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            if (
                bullets[i].x > boss.x &&
                bullets[i].x < boss.x + boss.width &&
                bullets[i].y > boss.y &&
                bullets[i].y < boss.y + boss.height
            ) {
                // Create small explosion on boss
                explosions.push({
                    x: bullets[i].x,
                    y: bullets[i].y,
                    radius: 15,
                    alpha: 1
                });

                bullets.splice(i, 1);
                boss.health--;
                score += 50;
                explosionSound.play();

                if (boss.health <= 0) {
                    handleBossDefeat();
                    break; // Exit loop after boss is defeated
                }
            }
        }
    }

    // Aliens vs Player
    for (let i = 0; i < aliens.length; i++) {
        if (
            player.x < aliens[i].x + aliens[i].width &&
            player.x + player.width > aliens[i].x &&
            player.y < aliens[i].y + aliens[i].height &&
            player.y + player.height > aliens[i].y
        ) {
            handleGameOver();
            return;
        }
    }
    
    // Player vs Boss
    if (bossActive && boss) {
        if (
            player.x < boss.x + boss.width &&
            player.x + player.width > boss.x &&
            player.y < boss.y + boss.height &&
            player.y + player.height > boss.y
        ) {
            handleGameOver();
            return;
        }
    }

    // Enemy Bullets vs Player
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        if (
            player.x < enemyBullets[i].x + 5 &&
            player.x + player.width > enemyBullets[i].x &&
            player.y < enemyBullets[i].y + 10 &&
            player.y + player.height > enemyBullets[i].y
        ) {
            handleGameOver();
            enemyBullets.splice(i, 1);
            return;
        }
    }

    // Power-ups vs Player
    for (let i = powerUps.length - 1; i >= 0; i--) {
        if (
            player.x < powerUps[i].x + powerUps[i].width &&
            player.x + player.width > powerUps[i].x &&
            player.y < powerUps[i].y + powerUps[i].height &&
            player.y + player.height > powerUps[i].y
        ) {
            const powerUp = powerUps[i];
            powerUps.splice(i, 1);
            
            // Apply power-up effect
            if (powerUp.type === 'speed' && powerUpSpeed < 3) {
                powerUpSpeed++;
            } else if (powerUp.type === 'fireRate' && powerUpFireRate < 7) {
                powerUpFireRate++;
            } else if (powerUp.type === 'wideShot') {
                if (powerUpWideShot < 3) {
                    powerUpWideShot++;
                } else if (powerUpFireRate < 7) {
                    // Wide shot is maxed, increase fire rate instead
                    powerUpFireRate++;
                }
            }
            
            // Play power-up sound (reuse shoot sound)
            shootSound.play();
            score += 500; // Bonus points for power-up
        }
    }
}


function spawnAlien() {
    const x = Math.random() * (canvas.width - alienWidth);
    const y = -alienHeight;
    const imgIndex = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
    aliens.push({
        x: x,
        y: y,
        width: alienWidth,
        height: alienHeight,
        dx: (Math.random() < 0.5 ? -1 : 1) * (alienSpeed / 2),
        dy: alienSpeed,
        type: 'normal',
        imgIndex: imgIndex,
        movePattern: imgIndex // Use the same index for both image and movement pattern
    });
}

function spawnSquad() {
    const startX = Math.random() * (canvas.width - (alienWidth + 15) * 4); // Ensure space for all 4 aliens with gaps
    const startY = -alienHeight;
    const leaderDx = (Math.random() < 0.5 ? -1 : 1) * (alienSpeed / 2);
    const leaderDy = alienSpeed / 2;
    const squadId = Date.now() + Math.random(); // Unique squad ID

    const leader = {
        x: startX,
        y: startY,
        width: alienWidth,
        height: alienHeight,
        dx: leaderDx,
        dy: leaderDy,
        type: 'squad',
        isLeader: true,
        squadId: squadId,
        movePattern: availableEnemies[Math.floor(Math.random() * availableEnemies.length)]
    };
    leader.imgIndex = leader.movePattern;
    aliens.push(leader);

    // Track this squad
    activeSquads.set(squadId, {
        totalMembers: 4,
        remainingMembers: 4,
        powerUpPosition: { x: startX + 60, y: startY }
    });

    for (let i = 0; i < 3; i++) {
        aliens.push({
            x: startX + (i + 1) * (alienWidth + 15), // Space followers with 1 character width + 15px gap
            y: startY,
            width: alienWidth,
            height: alienHeight,
            dx: 0,
            dy: 0,
            type: 'squad',
            isLeader: false,
            leader: leader,
            squadId: squadId,
            imgIndex: leader.imgIndex,
            movePattern: 'follower'
        });
    }
}

function spawnPowerUp(x, y) {
    const powerUpTypes = ['speed', 'fireRate', 'wideShot'];
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    
    powerUps.push({
        x: x,
        y: y,
        width: 20,
        height: 20,
        type: type,
        dy: 2 // Falling speed
    });
}

// Update game state
function update() {
    if (gameState === 'playing') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawStars();
        drawPlayer();
        drawBullets();
        drawEnemyBullets();
        drawAliens();
        drawBoss();
        drawPowerUps();
        drawExplosions();
        drawScore();

        // Check for boss spawn
        if (!bossActive && enemiesDefeated >= 20) {
            spawnBoss();
        }

        // Spawn aliens only if boss is not active
        if (!bossActive) {
            alienSpawnTimer--;
            if (alienSpawnTimer <= 0) {
                if (Math.random() < 0.3) { // 30% chance to spawn a squad
                    spawnSquad();
                } else {
                    spawnAlien();
                }
                alienSpawnTimer = Math.floor(Math.random() * 80) + 40;
            }
        }

        handleInputs();
        moveStars();
        movePlayer();
        moveBullets();
        moveEnemyBullets();
        movePowerUps();
        moveAliens();
        moveBoss();

        collisionDetection();

    } else if (gameState === 'respawning') {
        // Keep game running but don't handle inputs or spawn enemies
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        drawStars();
        drawBullets();
        drawEnemyBullets();
        drawAliens();
        drawBoss();
        drawExplosions();
        drawScore();
        
        // Continue moving game elements
        moveStars();
        moveBullets();
        moveEnemyBullets();
        moveAliens();
        moveBoss();
        
        // Show respawn message
        ctx.font = "20px 'Press Start 2P'";
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('RESPAWNING...', canvas.width / 2, canvas.height / 2);
    } else if (gameState === 'start') {
        handleInputs();
        drawStartScreen();
    } else if (gameState === 'gameover') {
        handleInputs();
        drawGameOverScreen();
    } else if (gameState === 'stage_clear') {
        drawStageClearScreen();
    } else if (gameState === 'paused') {
        // Handle inputs for pause/unpause
        handleInputs();
        
        // Draw paused state - keep game elements visible but frozen
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        drawStars();
        drawPlayer();
        drawBullets();
        drawEnemyBullets();
        drawAliens();
        drawBoss();
        drawExplosions();
        drawScore();
        
        // Draw pause overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = "30px 'Press Start 2P'";
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "16px 'Press Start 2P'";
        ctx.fillText('Press ESC or START to resume', canvas.width / 2, canvas.height / 2 + 20);
    }
    requestAnimationFrame(update);
}

function drawStartScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "30px 'Press Start 2P'";
    ctx.fillStyle = '#0f0';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE ASSAULT 8-BIT', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillText('PRESS SPACE TO START', canvas.width / 2, canvas.height / 2 + 20);

}

function drawGameOverScreen() {
    // Draw existing elements to show the final state
    drawStars();
    drawAliens();
    drawEnemyBullets();
    drawExplosions();
    drawScore();

    // Draw game over text
    ctx.font = "40px 'Press Start 2P'";
    ctx.fillStyle = 'red';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillStyle = '#fff';
    ctx.fillText('PRESS SPACE TO RESTART', canvas.width / 2, canvas.height / 2 + 20);
}

function drawStageClearScreen() {
    // Keep drawing the game state in the background
    drawStars();
    drawPlayer();
    drawExplosions();
    drawScore();

    // Draw stage clear text
    ctx.font = "40px 'Press Start 2P'";
    ctx.fillStyle = '#0f0';
    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${stage} CLEAR`, canvas.width / 2, canvas.height / 2);
}

function spawnBoss() {
    bossActive = true;
    gameBgm.pause();
    bossBgm.play();
    // Boss speed increases by 8% per stage (base speed 2)
    const baseSpeed = 2;
    const speedMultiplier = 1 + (stage - 1) * 0.08;
    const bossSpeed = baseSpeed * speedMultiplier;
    
    boss = {
        x: canvas.width / 2 - 75,
        y: -150,
        width: 150,
        height: 100,
        dx: bossSpeed,
        dy: 0,
        health: 50 * stage, // Increase health with stage
        fireRate: 60,
        fireCooldown: 60,
        // Dive attack properties
        isDiving: false,
        isReturning: false,
        diveCooldown: 120, // Initial cooldown before first dive attack (2 seconds)
        diveSpeed: 0,
        originalY: 0
    };
}

function handleInputs() {
    // --- Gamepad Input for game state changes (check this first, always) ---
    const gamepads = navigator.getGamepads();
    if (gamepads[0]) {
        const gp = gamepads[0];
        
        // Game state buttons (Start/Options button)
        const startButtonPressed = gp.buttons[9]?.pressed;
        if (startButtonPressed && !gamepadStartPressed) {
            // Button just pressed (not held)
            if (gameState === 'start') {
                openingBgm.pause();
                gameBgm.play();
                gameState = 'playing';
            } else if (gameState === 'gameover') {
                document.location.reload();
            } else if (gameState === 'playing') {
                gameState = 'paused';
                gameBgm.pause();
                if (bossActive) {
                    bossBgm.pause();
                }
            } else if (gameState === 'paused') {
                gameState = 'playing';
                gameBgm.play();
                if (bossActive) {
                    bossBgm.play();
                }
            }
        }
        gamepadStartPressed = startButtonPressed; // Update button state
    }

    // Only handle movement/shooting if not paused
    if (gameState !== 'playing') return;

    // Reset player movement, will be set by input below
    player.dx = 0;
    player.dy = 0;

    // --- Keyboard Input ---
    if (keys['ArrowRight'] || keys['d']) player.dx = player.speed;
    if (keys['ArrowLeft'] || keys['a']) player.dx = -player.speed;
    if (keys['ArrowUp'] || keys['w']) player.dy = -player.speed;
    if (keys['ArrowDown'] || keys['s']) player.dy = player.speed;
    shootButtonPressed = keys[' '] || keys['Spacebar'];

    // --- Gamepad Input (overwrites keyboard) ---
    if (gamepads[0]) {
        const gp = gamepads[0];
        const deadzone = 0.25;

        // Analog stick movement
        if (Math.abs(gp.axes[0]) > deadzone) {
            player.dx = gp.axes[0] * player.speed;
        }
        if (Math.abs(gp.axes[1]) > deadzone) {
            player.dy = gp.axes[1] * player.speed;
        }

        // D-pad movement
        if (gp.buttons[15]?.pressed) player.dx = player.speed; // Right
        if (gp.buttons[14]?.pressed) player.dx = -player.speed; // Left
        if (gp.buttons[12]?.pressed) player.dy = -player.speed; // Up
        if (gp.buttons[13]?.pressed) player.dy = player.speed; // Down

        // Shooting button
        if (gp.buttons[0]?.pressed) {
            shootButtonPressed = true;
        }
    }

    // --- Handle Actions ---
    const now = Date.now();
    // Apply fire rate power-up (base cooldown 150ms, -15ms per level, minimum 30ms)
    const currentCooldown = Math.max(30, shootCooldown - (powerUpFireRate * 15));
    
    // Calculate max bullets based on wide shot and fire rate levels
    let baseBullets;
    if (powerUpWideShot === 0) {
        baseBullets = 4 + Math.floor(powerUpFireRate / 2); // Normal shot: 4 + fire rate bonus
    } else if (powerUpWideShot === 1) {
        baseBullets = 3 * (1 + Math.floor(powerUpFireRate / 2)); // 3 bullets × fire rate multiplier
    } else if (powerUpWideShot === 2) {
        baseBullets = 5 * (1 + Math.floor(powerUpFireRate / 2)); // 5 bullets × fire rate multiplier
    } else if (powerUpWideShot === 3) {
        baseBullets = 7 * (1 + Math.floor(powerUpFireRate / 2)); // 7 bullets × fire rate multiplier
    }
    
    const maxBullets = baseBullets;
    if (shootButtonPressed && gameState === 'playing' && now - lastShotTime > currentCooldown) {
        if (bullets.length < maxBullets) {
            // Bullet speed increases by 8% per fire rate level
            const currentBulletSpeed = bulletSpeed * (1 + powerUpFireRate * 0.08);
            
            if (powerUpWideShot === 0) {
                // Normal shot
                bullets.push({ 
                    x: player.x + player.width / 2 - 2.5, 
                    y: player.y,
                    speed: currentBulletSpeed
                });
            } else if (powerUpWideShot === 1) {
                // Wide shot level 1 - 3 bullets in fan formation
                const centerX = player.x + player.width / 2;
                const centerY = player.y;
                const angleStep = Math.PI / 12; // 15 degrees
                
                for (let i = 0; i < 3; i++) {
                    const angle = (i - 1) * angleStep; // Center bullet straight up (0°), ±15°
                    bullets.push({
                        x: centerX - 2.5,
                        y: centerY,
                        dx: Math.sin(angle) * currentBulletSpeed,
                        dy: -Math.cos(angle) * currentBulletSpeed // Negative because up is negative Y
                    });
                }
            } else if (powerUpWideShot === 2) {
                // Wide shot level 2 - 5 bullets in fan formation
                const centerX = player.x + player.width / 2;
                const centerY = player.y;
                const angleStep = Math.PI / 12; // 15 degrees
                
                for (let i = 0; i < 5; i++) {
                    const angle = (i - 2) * angleStep; // Center bullet straight up (0°), ±15°, ±30°
                    bullets.push({
                        x: centerX - 2.5,
                        y: centerY,
                        dx: Math.sin(angle) * currentBulletSpeed,
                        dy: -Math.cos(angle) * currentBulletSpeed // Negative because up is negative Y
                    });
                }
            } else if (powerUpWideShot === 3) {
                // Wide shot level 3 - 7 bullets in fan formation (max 30 degrees)
                const centerX = player.x + player.width / 2;
                const centerY = player.y;
                const angleStep = Math.PI / 18; // 10 degrees
                
                for (let i = 0; i < 7; i++) {
                    const angle = (i - 3) * angleStep; // Center bullet straight up (0°), ±10°, ±20°, ±30°
                    bullets.push({
                        x: centerX - 2.5,
                        y: centerY,
                        dx: Math.sin(angle) * currentBulletSpeed,
                        dy: -Math.cos(angle) * currentBulletSpeed // Negative because up is negative Y
                    });
                }
            }
            shootSound.play();
            lastShotTime = now;
        }
    }
}

// Keyboard event handlers
function keyDown(e) {
    keys[e.key] = true;
    // Handle state changes that should only happen once on key press
    if (e.key === ' ' || e.key === 'Spacebar') {
        if (gameState === 'start') {
            openingBgm.pause();
            gameBgm.play();
            gameState = 'playing';
        } else if (gameState === 'gameover') {
            document.location.reload();
        }
    } else if (e.key === 'Escape') {
        // Pause/Unpause game
        if (gameState === 'playing') {
            gameState = 'paused';
            gameBgm.pause();
            if (bossActive) {
                bossBgm.pause();
            }
        } else if (gameState === 'paused') {
            gameState = 'playing';
            gameBgm.play();
            if (bossActive) {
                bossBgm.play();
            }
        }
    }
}

function keyUp(e) {
    keys[e.key] = false;
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    createStars();
    if (gameState === 'start') {
        openingBgm.play().catch(error => {
            console.log("Autoplay was prevented: ", error);
        });
    }
});

document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

update();