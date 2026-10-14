(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const healthEl = document.getElementById("health");
  const scoreEl = document.getElementById("score");
  const waveEl = document.getElementById("wave");
  const overlay = document.getElementById("overlay");
  const messageEl = document.getElementById("message");
  const hintEl = document.getElementById("hint");
  const startButton = document.getElementById("start");

  const W = canvas.width;
  const H = canvas.height;
  const keys = new Set();
  const movementCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);
  let running = false;
  let gameOver = false;
  let lastTime = 0;
  let spawnTimer = 0;
  let shootTimer = 0;
  let score = 0;
  let wave = 1;
  let elapsed = 0;
  let player;
  let zombies = [];
  let bullets = [];
  let particles = [];
  let mouse = { x: W / 2, y: H / 2, down: false };

  function resetGame() {
    keys.clear();
    score = 0;
    wave = 1;
    elapsed = 0;
    spawnTimer = 0.5;
    shootTimer = 0;
    zombies = [];
    bullets = [];
    particles = [];
    player = { x: W / 2, y: H / 2, radius: 14, speed: 235, health: 100, invulnerable: 0 };
    for (let i = 0; i < 5; i++) spawnZombie();
    updateHud();
  }

  function updateHud() {
    healthEl.textContent = Math.max(0, Math.ceil(player ? player.health : 100));
    scoreEl.textContent = score;
    waveEl.textContent = wave;
  }

  function spawnZombie() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * W; y = -24; }
    else if (side === 1) { x = W + 24; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = H + 24; }
    else { x = -24; y = Math.random() * H; }
    const tough = Math.random() < Math.min(0.08 + wave * 0.025, 0.35);
    zombies.push({
      x, y, radius: tough ? 17 : 13,
      speed: (tough ? 42 : 54) + Math.random() * 20 + Math.min(wave * 2, 35),
      health: tough ? 3 : 2,
      tough,
      wobble: Math.random() * Math.PI * 2,
      attackCooldown: 0
    });
  }

  function addParticles(x, y, color, count = 7) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 150;
      const life = 0.2 + Math.random() * 0.45;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life, maxLife: life, size: 1.5 + Math.random() * 3, color
      });
    }
  }

  function aimPoint(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * W / rect.width;
    mouse.y = (event.clientY - rect.top) * H / rect.height;
  }

  function shoot() {
    if (!player || shootTimer > 0) return;
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    bullets.push({
      x: player.x + dx / length * 19,
      y: player.y + dy / length * 19,
      vx: dx / length * 620,
      vy: dy / length * 620,
      life: 1.1,
      radius: 3.5
    });
    shootTimer = 0.16;
    addParticles(player.x + dx / length * 18, player.y + dy / length * 18, "#b7f36b", 2);
  }

  function endGame() {
    running = false;
    gameOver = true;
    mouse.down = false;
    keys.clear();
    messageEl.textContent = "Game Over";
    hintEl.textContent = `You scored ${score}. Press the button to try again.`;
    startButton.textContent = "PLAY AGAIN";
    overlay.classList.remove("hidden");
  }

  function startGame() {
    resetGame();
    gameOver = false;
    running = true;
    lastTime = performance.now();
    overlay.classList.add("hidden");
    canvas.focus();
  }

  // Use event.code, not event.key, so controls work with English or Persian keyboard layouts.
  window.addEventListener("keydown", (event) => {
    if (movementCodes.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  window.addEventListener("blur", () => {
    keys.clear();
    mouse.down = false;
  });

  canvas.addEventListener("pointermove", aimPoint);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !running) return;
    aimPoint(event);
    mouse.down = true;
    shoot();
    canvas.setPointerCapture?.(event.pointerId);
  });
  window.addEventListener("pointerup", (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  startButton.addEventListener("click", startGame);

  function update(dt) {
    if (!running) return;
    elapsed += dt;
    wave = 1 + Math.floor(elapsed / 22);
    shootTimer = Math.max(0, shootTimer - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    const dx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const dy = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
    const length = Math.hypot(dx, dy) || 1;
    player.x += dx / length * player.speed * dt;
    player.y += dy / length * player.speed * dt;
    player.x = Math.max(player.radius, Math.min(W - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(H - player.radius, player.y));

    if (mouse.down) shoot();

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnZombie();
      spawnTimer = Math.max(0.3, 1.15 - wave * 0.055) * (0.7 + Math.random() * 0.6);
    }

    for (const z of zombies) {
      z.wobble += dt * 5;
      z.attackCooldown = Math.max(0, z.attackCooldown - dt);
      const vx = player.x - z.x;
      const vy = player.y - z.y;
      const dist = Math.hypot(vx, vy) || 1;
      z.x += vx / dist * z.speed * dt;
      z.y += vy / dist * z.speed * dt;
      if (dist < player.radius + z.radius && z.attackCooldown <= 0 && player.invulnerable <= 0) {
        player.health -= z.tough ? 13 : 8;
        player.invulnerable = 0.55;
        z.attackCooldown = 0.8;
        addParticles(player.x, player.y, "#ff625f", 8);
        if (player.health <= 0) {
          player.health = 0;
          updateHud();
          endGame();
          return;
        }
      }
    }

    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const z of zombies) {
        if (z.health <= 0) continue;
        if (Math.hypot(z.x - b.x, z.y - b.y) < z.radius + b.radius) {
          z.health -= 1;
          b.life = 0;
          addParticles(b.x, b.y, z.tough ? "#d1e7a0" : "#8fbd68", 4);
          if (z.health <= 0) {
            score += z.tough ? 25 : 10;
            addParticles(z.x, z.y, "#78a95a", 10);
          }
          break;
        }
      }
    }

    bullets = bullets.filter(b => b.life > 0 && b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10);
    zombies = zombies.filter(z => z.health > 0);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.04, dt);
      p.vy *= Math.pow(0.04, dt);
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
    updateHud();
  }

  function drawBackground() {
    ctx.fillStyle = "#0b1318";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(111,145,150,0.075)";
    ctx.lineWidth = 1;
    const grid = 40;
    for (let x = 0; x <= W; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // Subtle scattered ground marks
    for (let i = 0; i < 24; i++) {
      const x = (i * 173 + 43) % W;
      const y = (i * 97 + 61) % H;
      ctx.fillStyle = "rgba(122,151,135,0.07)";
      ctx.fillRect(x, y, 15, 2);
    }
    const vignette = ctx.createRadialGradient(W/2, H/2, 100, W/2, H/2, W*0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPlayer() {
    if (!player) return;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(angle);
    ctx.fillStyle = "#b7f36b";
    ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#24351b";
    ctx.beginPath(); ctx.arc(3, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(6, -4, 20, 8);
    ctx.fillStyle = "#e7ffc8";
    ctx.fillRect(19, -2, 10, 4);
    ctx.restore();
    if (player.invulnerable > 0 && Math.floor(performance.now() / 70) % 2 === 0) {
      ctx.strokeStyle = "#ffffffaa";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI*2); ctx.stroke();
    }
  }

  function drawZombie(z) {
    const angle = Math.atan2(player.y - z.y, player.x - z.x);
    ctx.save();
    ctx.translate(z.x, z.y + Math.sin(z.wobble) * 2);
    ctx.rotate(angle);
    ctx.fillStyle = z.tough ? "#9caa68" : "#5f936d";
    ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#24372c";
    ctx.fillRect(-3, -z.radius * 0.45, 4, 4);
    ctx.fillRect(4, -z.radius * 0.45, 4, 4);
    ctx.fillStyle = "#d8e9ad";
    ctx.fillRect(5, z.radius * 0.25, 7, 3);
    ctx.restore();
    if (z.tough) {
      ctx.fillStyle = "#27332a";
      ctx.fillRect(z.x - 17, z.y - z.radius - 8, 34, 4);
      ctx.fillStyle = "#d1e7a0";
      ctx.fillRect(z.x - 17, z.y - z.radius - 8, 34 * Math.max(0,z.health) / 3, 4);
    }
  }

  function render() {
    drawBackground();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of bullets) {
      ctx.fillStyle = "#d9ff9d";
      ctx.shadowColor = "#b7f36b";
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const z of zombies) drawZombie(z);
    drawPlayer();
    if (running) {
      ctx.strokeStyle = "#d7f6b477";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mouse.x - 13, mouse.y); ctx.lineTo(mouse.x - 5, mouse.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mouse.x + 5, mouse.y); ctx.lineTo(mouse.x + 13, mouse.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y - 13); ctx.lineTo(mouse.x, mouse.y - 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y + 5); ctx.lineTo(mouse.x, mouse.y + 13); ctx.stroke();
    }
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000 || 0, 0.033);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  resetGame();
  render();
  requestAnimationFrame((now) => {
    lastTime = now;
    loop(now);
  });
})();
