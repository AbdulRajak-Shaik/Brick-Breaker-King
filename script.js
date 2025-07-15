// ========== AdMob Setup ==========
document.addEventListener('deviceready', async () => {
  if (typeof AdMobFree !== 'undefined') {
    try {
      AdMobFree.banner.config({
        id: 'ca-app-pub-1930983372949551/9182010937',
        isTesting: true,
        autoShow: true
      });
      await AdMobFree.banner.prepare();

      AdMobFree.interstitial.config({
        id: 'ca-app-pub-1930983372949551/7669193682',
        isTesting: true,
        autoShow: false
      });
      await AdMobFree.interstitial.prepare();
    } catch (err) {
      console.log('AdMob error:', err);
    }
  } else {
    console.log('AdMobFree not available — likely testing in browser.');
  }
});

// ------------------ GAME CODE ------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const bgMusic = document.getElementById("bgMusic");
const sfxHit = document.getElementById("sfxHit");
const sfxBoss = document.getElementById("sfxBoss");
const sfxPower = document.getElementById("sfxPower");
const sfxShoot = document.getElementById("sfxShoot");

let muted = false, paused = false;
let paddle = { x: 200, width: 80, height: 10 };
let targetPaddleX = paddle.x;
let balls = [], bricks = [], bullets = [], powerUps = [], bossBullets = [];
let score = 0, lives = 3, level = 1, gameStarted = false;
let boss = { x: 150, y: 50, width: 100, height: 30, dx: 2, hp: 5, shootCooldown: 0 };
let shooting = false, slowMotion = false;
let shootingInterval = null;

function toggleMute() {
  muted = !muted;
  [bgMusic, sfxHit, sfxBoss, sfxPower, sfxShoot].forEach(a => a.muted = muted);
  document.getElementById("muteBtn").textContent = muted ? "🔇" : "🔊";
}
document.getElementById("muteBtn").onclick = toggleMute;

document.getElementById("resetBtn")?.addEventListener("click", () => {
  localStorage.removeItem("highScores");
  alert("Leaderboard reset!");
  updateLeaderboard();
});

function shootBullet() {
  if (shooting) {
    bullets.push({ x: paddle.x + 10, y: canvas.height - 30, dy: -5 });
    bullets.push({ x: paddle.x + paddle.width - 14, y: canvas.height - 30, dy: -5 });
    sfxShoot.play();
  }
}

// Mouse control
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  targetPaddleX = Math.min(canvas.width - paddle.width, Math.max(0, mouseX - paddle.width / 2));
});

// Touch control — paddle smoothly follows finger
canvas.addEventListener("touchstart", handleTouchMove, { passive: false });
canvas.addEventListener("touchmove", handleTouchMove, { passive: false });

function handleTouchMove(e) {
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const touchX = touch.clientX - rect.left;
  targetPaddleX = Math.min(canvas.width - paddle.width, Math.max(0, touchX - paddle.width / 2));
  e.preventDefault();
}

document.getElementById("pauseBtn")?.addEventListener("click", () => {
  paused = !paused;
  document.getElementById("pauseBtn").textContent = paused ? "▶️" : "⏸️";
  if (!paused) requestAnimationFrame(draw);
});

function startGame() {
  document.getElementById("menuScreen").style.display = "none";
  document.getElementById("gameOverScreen").style.display = "none";
  bgMusic.play().catch(err => console.log("Background music play error:", err));
  gameStarted = true;
  level = 1;
  score = 0;
  lives = 3;
  showLevelIntro();
}

function returnToMenu() {
  document.getElementById("gameOverScreen").style.display = "none";
  document.getElementById("menuScreen").style.display = "flex";
}

function showLevelIntro() {
  document.getElementById("levelIntro").style.display = "flex";
  document.getElementById("levelText").textContent = `Level ${level} - Get Ready!`;
  setTimeout(() => {
    document.getElementById("levelIntro").style.display = "none";
    initLevel();
    requestAnimationFrame(draw);
  }, 1500);
}

function initLevel() {
  bricks = [];
  balls = [{ x: 240, y: 300, dx: 2 + level * 0.25, dy: -2 - level * 0.25, radius: 6 }];
  bullets = [];
  powerUps = [];
  bossBullets = [];
  paddle.width = Math.max(40, 80 - (level - 1) * 5);
  shooting = false;
  slowMotion = false;
  clearInterval(shootingInterval);

  for (let i = 0; i < 5 + level; i++) {
    for (let j = 0; j < 8; j++) {
      const power = Math.random() < 0.25;
      const type = power ? ["shoot", "multiball", "grow", "shrink", "slow"][Math.floor(Math.random() * 5)] : null;
      bricks.push({ x: 60 * j + 20, y: 30 * i + 40, w: 50, h: 20, power, type });
    }
  }

  boss.hp = 5 + level * 2;
  boss.x = 150;
  boss.dx = 2 + level * 0.3;
  boss.shootCooldown = 100;
}

function saveHighScore(newScore) {
  let scores = JSON.parse(localStorage.getItem("highScores")) || [];
  scores.push(newScore);
  scores.sort((a, b) => b - a);
  scores = scores.slice(0, 5);
  localStorage.setItem("highScores", JSON.stringify(scores));
  updateLeaderboard();
}

function updateLeaderboard() {
  const scores = JSON.parse(localStorage.getItem("highScores")) || [];
  const list = document.getElementById("leaderboardList");
  if (!list) return;
  list.innerHTML = scores.map((s, i) => `<li>#${i + 1}: ${s}</li>`).join("");
}

document.addEventListener("DOMContentLoaded", updateLeaderboard);

function getActivePowerUpColor(type) {
  return {
    shoot: "orange",
    multiball: "purple",
    grow: "lime",
    shrink: "pink",
    slow: "blue"
  }[type] || "white";
}

function drawPowerUps() {
  powerUps.forEach(p => {
    ctx.fillStyle = getActivePowerUpColor(p.type);
    ctx.fillRect(p.x, p.y, 20, 20);
    ctx.fillStyle = "black";
    ctx.font = "bold 12px Arial";
    ctx.fillText(p.type[0].toUpperCase(), p.x + 5, p.y + 15);
    p.y += 2;
  });
}

function handlePowerUpCollection() {
  powerUps = powerUps.filter(p => {
    if (p.y > canvas.height) return false;
    if (p.y + 20 > canvas.height - 20 && p.x > paddle.x && p.x < paddle.x + paddle.width) {
      switch (p.type) {
        case "shoot":
          shooting = true;
          clearInterval(shootingInterval);
          shootingInterval = setInterval(shootBullet, 500);
          setTimeout(() => {
            shooting = false;
            clearInterval(shootingInterval);
          }, 7000);
          break;
        case "multiball":
          balls.push({ ...balls[0], dx: balls[0].dx + 1 });
          balls.push({ ...balls[0], dx: balls[0].dx - 1 });
          break;
        case "grow":
          paddle.width = Math.min(canvas.width, paddle.width + 30);
          break;
        case "shrink":
          paddle.width = Math.max(30, paddle.width - 30);
          break;
        case "slow":
          slowMotion = true;
          setTimeout(() => slowMotion = false, 5000);
          break;
      }
      sfxPower.play();
      return false;
    }
    return true;
  });
}

function drawBullets() {
  bullets = bullets.filter(b => {
    ctx.fillStyle = "yellow";
    ctx.fillRect(b.x, b.y, 4, 10);
    b.y += b.dy;
    for (let i = 0; i < bricks.length; i++) {
      if (b.x > bricks[i].x && b.x < bricks[i].x + bricks[i].w && b.y < bricks[i].y + bricks[i].h) {
        score += 10;
        sfxHit.play();
        if (bricks[i].power) {
          powerUps.push({ x: bricks[i].x + bricks[i].w / 2 - 10, y: bricks[i].y, type: bricks[i].type });
        }
        bricks.splice(i, 1);
        return false;
      }
    }
    return b.y > 0;
  });
}

function draw() {
  if (!gameStarted || paused) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillText(`Score: ${score}  Lives: ${lives}`, 10, 20);

  // Smooth paddle motion
  paddle.x = targetPaddleX;
  ctx.fillRect(paddle.x, canvas.height - 20, paddle.width, paddle.height);

  bricks.forEach(b => {
    ctx.fillStyle = b.power ? getActivePowerUpColor(b.type) : "cyan";
    ctx.fillRect(b.x, b.y, b.w, b.h);
  });

  if (boss.hp > 0) {
    ctx.fillStyle = "red";
    ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
    ctx.fillStyle = "white";
    ctx.fillText(`Boss HP: ${boss.hp}`, boss.x + 10, boss.y + 20);
    boss.x += boss.dx;
    if (boss.x <= 0 || boss.x + boss.width >= canvas.width) boss.dx *= -1;
  }

  balls = balls.filter(ball => {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ball.x += ball.dx * (slowMotion ? 0.5 : 1);
    ball.y += ball.dy * (slowMotion ? 0.5 : 1);

    if (ball.x < 0 || ball.x > canvas.width) ball.dx *= -1;
    if (ball.y < 0) ball.dy *= -1;
    if (ball.y > canvas.height) return false;

    if (ball.x > paddle.x && ball.x < paddle.x + paddle.width && ball.y > canvas.height - 30) {
      ball.dy *= -1;
    }

    bricks = bricks.filter(b => {
      if (ball.x > b.x && ball.x < b.x + b.w && ball.y > b.y && ball.y < b.y + b.h) {
        ball.dy *= -1;
        score += 10;
        if (b.power) {
          powerUps.push({ x: b.x + b.w / 2 - 10, y: b.y, type: b.type });
          sfxPower.play();
        } else {
          sfxHit.play();
        }
        return false;
      }
      return true;
    });

    if (boss.hp > 0 && ball.x > boss.x && ball.x < boss.x + boss.width && ball.y > boss.y && ball.y < boss.y + boss.height) {
      ball.dy *= -1;
      boss.hp--;
      sfxBoss.play();
      score += 20;
    }

    return true;
  });

  if (balls.length === 0) {
    lives--;
    if (lives <= 0) {
      saveHighScore(score);
      gameStarted = false;
      document.getElementById("finalScoreText").textContent = "Your Score: " + score;
      document.getElementById("gameOverScreen").style.display = "flex";
      showInterstitialAd();
      return;
    } else {
      balls = [{ x: 240, y: 300, dx: 2 + level * 0.25, dy: -2 - level * 0.25, radius: 6 }];
    }
  }

  drawPowerUps();
  handlePowerUpCollection();
  drawBullets();

  if (bricks.length === 0 && boss.hp <= 0) {
    level++;
    showLevelIntro();
    return;
  }

  requestAnimationFrame(draw);
}
