// =================================================================
// --- 1. 全局配置与常量 ---
// =================================================================
const CONFIG = {
    TEXT_SIZE: 12, TEXT_LINE_SPACING: 15, TEXT_CHAR_SPACING: 9,
    JITTER_STRENGTH: 0.3, ACTIVATED_JITTER_STRENGTH: 0.8,
    ACTIVATION_RADIUS: 60, HOVER_RADIUS: 80, HOVER_REPEL_FORCE: 1.5,
    VORTEX_FORCE_MULTIPLIER: 0.005,
    GRAVITY: 0.1, FLOWER_CLUSTER_LIFESPAN: 500, FLOWER_GROWTH_SPEED: 0.3,
    GROWTH_RATE: 0.2, GROUND_Y_OFFSET: 60,
    WIND_BLAST_FORCE: null,
};

const STATE = { IDLE: 0, ACTIVATED: 1, FALLING: 2, SEED: 3, SPROUT: 4, WHEAT: 5, REORGANIZING: 6 };

const TEXT_LINES = [
    "the absence of certainty also lies in its", "inability to capture the fragile and",
    "fractured nature of reality we are but", "a fleeting glimpse a momentary blush",
    "a faint echo in the vast expanse of time", "our perceptions are filtered through the",
    "prisms of our individual experiences each", "one a unique and distorted reflection of",
    "the world we are constantly in a state of", "flux a perpetual dance between becoming",
    "and dissolving life is a series of", "discoveries a journey of uncovering the",
    "hidden layers of our own being and the", "world around us we must embrace this",
    "uncertainty for in it lies the freedom",
    "to create our own meaning to find our", "own sanctuary in the midst of chaos"
];

let particles = [], flowerClusters = [], rain = [], harvestSparks = [], ripples = [];
let ground, textBounds, gravity;
let isRaining = false;
let isNight = false;
let dayColors, nightColors, currentColors;
let vortexForce = 0;

// =================================================================
// --- 2. p5.js 主流程 ---
// =================================================================
function setup() {
    createCanvas(windowWidth, windowHeight);
    
    dayColors = { bg: color('#FDF4E3'), text: color(100, 100, 120, 200), activeText: color(255, 105, 180, 220), ground: color(223, 212, 192), groundParticles: color(180, 165, 145, 90), rain: color(138, 180, 220, 150), plantGreen: color(100, 200, 100), plantYellow: color(218, 165, 32), ripple: color(138, 180, 220, 150) };
    nightColors = { bg: color('#0d1b2a'), text: color(240, 240, 255, 150), activeText: color(255, 150, 200, 255), ground: color(25, 35, 45), groundParticles: color(60, 70, 80, 90), rain: color(180, 210, 250, 150), plantGreen: color(120, 220, 120), plantYellow: color(255, 200, 80), ripple: color(220, 240, 255, 150) };
    let currentHour = hour();
    isNight = (currentHour >= 18 || currentHour < 6);
    currentColors = isNight ? nightColors : dayColors;

    gravity = createVector(0, CONFIG.GRAVITY);
    CONFIG.WIND_BLAST_FORCE = createVector(0.8, 0);

    ground = new Ground(height - CONFIG.GROUND_Y_OFFSET, CONFIG.GROUND_Y_OFFSET);
    initializeText();
}

function draw() {
    background(currentColors.bg);
    ground.display(isRaining);
    isRaining = rain.length > 0;
    
    rain.forEach(r => { r.update(); r.display(); });
    ripples.forEach(r => { r.update(); r.display(); });
    particles.forEach(p => { p.update(isRaining); p.display(); });
    flowerClusters.forEach(fc => { fc.update(); fc.display(); });
    harvestSparks.forEach(hs => { hs.update(); hs.display(); });
    
    let sparkCountBefore = harvestSparks.length;
    rain = rain.filter(r => !r.isOffscreen());
    ripples = ripples.filter(r => !r.isDead());
    harvestSparks = harvestSparks.filter(hs => !hs.isDead());
    let sparkCountAfter = harvestSparks.length;

    if (sparkCountBefore > 0 && sparkCountAfter === 0) {
        triggerReorganization();
    }
    
    flowerClusters = flowerClusters.filter(fc => {
        if (fc.isDead()) { fc.respawnParticles(); return false; }
        return true;
    });

    vortexForce *= 0.95;
}

// =================================================================
// --- 3. 交互与逻辑 ---
// =================================================================
function mousePressed() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        if (p.state === STATE.WHEAT && p.growth >= 100) {
            if (dist(mouseX, mouseY, p.pos.x, p.pos.y) < 20) {
                for (let j = 0; j < 20; j++) harvestSparks.push(new HarvestSpark(p.pos.x, p.pos.y));
                particles.splice(i, 1);
                return;
            }
        }
    }

    if (mouseX > textBounds.x && mouseX < textBounds.x + textBounds.w && mouseY > textBounds.y && mouseY < textBounds.y + textBounds.h) {
        let particlesInRadius = [], allAreActivated = true;
        particles.forEach(p => {
            if (p.state === STATE.IDLE || p.state === STATE.ACTIVATED) {
                if (dist(mouseX, mouseY, p.pos.x, p.pos.y) < CONFIG.ACTIVATION_RADIUS) {
                    particlesInRadius.push(p);
                    if (p.state === STATE.IDLE) allAreActivated = false;
                }
            }
        });
        if (allAreActivated && particlesInRadius.length > 0) {
            let fallingParticlesInfo = particlesInRadius.map(p => ({ char: p.char, origin: p.origin }));
            if (fallingParticlesInfo.length > 0) flowerClusters.push(new FlowerCluster(fallingParticlesInfo));
            particlesInRadius.forEach(p => p.fall());
        } else {
            particlesInRadius.forEach(p => p.activate());
        }
    }
}

function mouseDragged() {
    if (mouseX < textBounds.x || mouseX > textBounds.x + textBounds.w || mouseY < textBounds.y || mouseY > textBounds.y + textBounds.h) {
        if (frameCount % 3 === 0) rain.push(new RainDrop(mouseX));
    }
}

function mouseWheel(event) {
    vortexForce += event.delta * CONFIG.VORTEX_FORCE_MULTIPLIER;
    vortexForce = constrain(vortexForce, -0.2, 0.2);
    return false;
}

function keyPressed() {
    if (key === ' ') {
        particles.forEach(p => { if (p.state === STATE.WHEAT || p.state === STATE.SPROUT) p.applyForce(CONFIG.WIND_BLAST_FORCE); });
    }
}

function triggerReorganization() {
    let availableParticles = particles.filter(p => p.state === STATE.IDLE || p.state === STATE.ACTIVATED);
    let availableOrigins = availableParticles.map(p => p.origin);
    shuffle(availableOrigins, true);
    
    for(let i = 0; i < availableParticles.length; i++){
        availableParticles[i].reorganize(availableOrigins[i]);
    }
}

// =================================================================
// --- 4. 对象类 ---
// =================================================================

class Ground {
    constructor(y, height, particleDensity = 0.4) {
        this.y = y; this.height = height; this.particles = [];
        let particleCount = width * height * particleDensity / 100;
        for (let i = 0; i < particleCount; i++) { this.particles.push({ x: random(width), y: this.y + random(this.height), phase: random(TWO_PI), size: random(1, 2.5) }); }
    }
    display(isRaining) {
        noStroke(); fill(currentColors.ground); rect(0, this.y, width, height - this.y);
        fill(currentColors.groundParticles);
        this.particles.forEach(p => {
            let wave = sin(frameCount * 0.02 + p.phase + p.x * 0.01) * 2;
            let drift = (noise(p.y * 0.05, frameCount * 0.01) - 0.5) * 0.5;
            ellipse(p.x + drift, p.y + wave, p.size, p.size);
        });
        if (isRaining) {
            noStroke(); fill(180, 170, 150, 50);
            for (let i = 0; i < 10; i++) {
                let x = noise(i * 10, frameCount * 0.005) * width;
                let y = this.y + noise(i * 20, frameCount * 0.005) * 10;
                let w = 50 + noise(i * 30, frameCount * 0.005) * 150;
                let h = 5 + noise(i * 40, frameCount * 0.005) * 10;
                ellipse(x, y, w, h);
            }
        }
    }
}

class Particle {
    constructor(char, x, y) {
        this.origin = createVector(x, y); this.pos = createVector(x, y);
        this.vel = createVector(); this.acc = createVector();
        this.char = char; this.state = STATE.IDLE;
        this.growth = 0; this.sway = random(TWO_PI);
        this.reorgTarget = null;
    }
    
    applyForce(force) { this.acc.add(force); }
    activate() { if (this.state === STATE.IDLE) this.state = STATE.ACTIVATED; }
    fall() { if (this.state === STATE.ACTIVATED) this.state = STATE.FALLING; }
    reorganize(newOrigin) { this.state = STATE.REORGANIZING; this.reorgTarget = newOrigin; }
    
    update(isRaining) {
        if (this.state === STATE.REORGANIZING) {
            this.pos.lerp(this.reorgTarget, 0.05);
            if (p5.Vector.dist(this.pos, this.reorgTarget) < 0.1) {
                this.pos.set(this.reorgTarget);
                this.origin.set(this.reorgTarget);
                this.state = STATE.IDLE;
                this.reorgTarget = null;
            }
        } else if (this.state === STATE.IDLE || this.state === STATE.ACTIVATED) {
            let d = dist(mouseX, mouseY, this.pos.x, this.pos.y);
            if (d < CONFIG.HOVER_RADIUS) {
                let repelForce = p5.Vector.sub(this.pos, createVector(mouseX, mouseY));
                repelForce.setMag(map(d, 0, CONFIG.HOVER_RADIUS, CONFIG.HOVER_REPEL_FORCE, 0));
                this.applyForce(repelForce);
            }
            if (abs(vortexForce) > 0.001) {
                let vortexVec = p5.Vector.sub(this.pos, createVector(mouseX, mouseY));
                if (vortexVec.mag() < CONFIG.HOVER_RADIUS * 1.5) {
                    vortexVec.rotate(HALF_PI);
                    vortexVec.setMag(vortexForce);
                    this.applyForce(vortexVec);
                }
            }
            let jitterForce = (this.state === STATE.IDLE) ? p5.Vector.random2D().mult(CONFIG.JITTER_STRENGTH) : p5.Vector.random2D().mult(CONFIG.ACTIVATED_JITTER_STRENGTH);
            this.applyForce(jitterForce);
            let returnForce = p5.Vector.sub(this.origin, this.pos);
            this.applyForce(returnForce.mult(0.1));
        } else if (this.state === STATE.FALLING) {
            this.applyForce(gravity);
        } else if (this.state >= STATE.SEED) {
            if (this.state === STATE.SEED && isRaining) this.state = STATE.SPROUT;
            if ((this.state === STATE.SPROUT || this.state === STATE.WHEAT) && isRaining && this.growth < 100) {
                this.growth += CONFIG.GROWTH_RATE;
                if (this.growth > 30) this.state = STATE.WHEAT;
            }
        }
        
        if (this.state === STATE.FALLING && this.pos.y >= ground.y) {
            this.pos.y = ground.y; this.state = STATE.SEED; this.vel.mult(0);
        }

        this.vel.add(this.acc); this.vel.limit(5); this.pos.add(this.vel);
        this.acc.mult(0); this.vel.mult(0.95);
    }
    
    display() {
        push(); translate(this.pos.x, this.pos.y); textAlign(CENTER, CENTER); noStroke();
        if (isNight) { drawingContext.shadowBlur = 8; drawingContext.shadowColor = color(255, 255, 200, 100); }
        switch (this.state) {
            case STATE.IDLE: fill(currentColors.text); textSize(CONFIG.TEXT_SIZE); text(this.char, 0, 0); break;
            case STATE.ACTIVATED: case STATE.FALLING: fill(currentColors.activeText); textSize(CONFIG.TEXT_SIZE + 2); text(this.char, 0, 0); break;
            case STATE.SEED: fill(80, 50, 20); ellipse(0, 0, 5, 3); break;
            case STATE.SPROUT: case STATE.WHEAT: this.drawWheat(); break;
            case STATE.REORGANIZING: fill(currentColors.text); textSize(CONFIG.TEXT_SIZE); text(this.char, 0, 0); break;
        }
        drawingContext.shadowBlur = 0;
        pop();
    }
    
    drawWheat() {
        let swayAngle = sin(frameCount * 0.05 + this.sway) * 0.1; rotate(swayAngle); noStroke();
        let growthRatio = constrain(map(this.growth, 0, 80, 0, 1), 0, 1);
        let currentColor = lerpColor(currentColors.plantGreen, currentColors.plantYellow, growthRatio);
        let stalkHeight = this.growth * 0.8; fill(currentColor); rect(-1, -stalkHeight, 2, stalkHeight);
        if (this.state === STATE.WHEAT) {
            let headSize = map(this.growth, 30, 100, 2, 8); fill(currentColors.plantYellow);
            for (let i = 0; i < 5; i++) ellipse(0, -stalkHeight - i * 4, headSize, headSize * 0.8);
        } else {
            fill(currentColors.plantGreen); arc(0, -stalkHeight, 10, 10, -PI, 0);
        }
    }
}

class RainDrop {
    constructor(x = random(width)) { this.x = x; this.y = random(-100, 0); this.speed = random(4, 10); this.len = random(10, 20); }
    update() { this.y += this.speed; if (this.y >= ground.y) { ripples.push(new Ripple(this.x, this.y)); this.y = height + 100; } }
    display() { stroke(currentColors.rain); strokeWeight(1.5); line(this.x, this.y, this.x, this.y + this.len); }
    isOffscreen() { return this.y > height; }
}

class Ripple {
    constructor(x, y) { this.pos = createVector(x, y); this.radius = 0; this.maxRadius = random(20, 40); this.lifespan = 255; }
    update() { this.radius += 0.5; this.lifespan -= 5; }
    display() {
        let c = currentColors.ripple;
        stroke(c.levels[0], c.levels[1], c.levels[2], this.lifespan);
        strokeWeight(map(this.lifespan, 255, 0, 2, 0));
        noFill();
        ellipse(this.pos.x, this.pos.y, this.radius * 2);
    }
    isDead() { return this.lifespan < 0; }
}

class Flower {
    constructor(pos, maxSize, color, lifespan) {
        this.pos = pos; this.maxSize = maxSize; this.color = color;
        this.lifespan = lifespan; this.initialLifespan = lifespan; this.growth = 0;
    }
    update() { if (this.growth < this.maxSize) this.growth += CONFIG.FLOWER_GROWTH_SPEED; this.lifespan--; }
    display() {
        push(); translate(this.pos.x, this.pos.y);
        let alpha = map(this.lifespan, this.initialLifespan, 0, 255, 0, true);
        noStroke(); fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], alpha);
        for (let i = 0; i < 5; i++) { rotate(TWO_PI / 5); ellipse(0, -this.growth / 4, this.growth / 3, this.growth / 1.5); }
        if (isNight) { drawingContext.shadowBlur = 12; drawingContext.shadowColor = color(255, 220, 120, 200); }
        fill(255, 255, 0, alpha); ellipse(0, 0, this.growth / 3, this.growth / 3);
        drawingContext.shadowBlur = 0;
        pop();
    }
    isDead() { return this.lifespan <= 0; }
}

class FlowerCluster {
    constructor(fallenParticlesInfo) {
        this.particlesToRespawn = fallenParticlesInfo; this.flowers = [];
        let center = createVector(0, 0);
        this.particlesToRespawn.forEach(p_info => center.add(p_info.origin));
        center.div(this.particlesToRespawn.length);
        let numFlowers = floor(random(2, 6));
        let baseColor = color(255, random(160, 200), random(170, 210));
        for (let i = 0; i < numFlowers; i++) {
            let offset = p5.Vector.random2D().mult(random(5, 25));
            let flowerPos = p5.Vector.add(center, offset);
            let maxSize = random(10, 25);
            let flowerColor = color(baseColor.levels[0], baseColor.levels[1] + random(-20, 20), baseColor.levels[2] + random(-20, 20));
            this.flowers.push(new Flower(flowerPos, maxSize, flowerColor, CONFIG.FLOWER_CLUSTER_LIFESPAN - random(0, 50)));
        }
    }
    update() { this.flowers.forEach(f => f.update()); }
    display() { this.flowers.forEach(f => f.display()); }
    isDead() { return this.flowers.every(f => f.isDead()); }
    respawnParticles() { this.particlesToRespawn.forEach(p_info => particles.push(new Particle(p_info.char, p_info.origin.x, p_info.origin.y))); }
}

class HarvestSpark {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D().mult(random(0.5, 2.5));
        this.vel.y = -abs(this.vel.y) * 1.5;
        this.lifespan = 255;
    }
    update() { this.vel.mult(0.98); this.pos.add(this.vel); this.lifespan -= 4; }
    display() {
        noStroke();
        fill(currentColors.plantYellow.levels[0], currentColors.plantYellow.levels[1], currentColors.plantYellow.levels[2], this.lifespan);
        ellipse(this.pos.x, this.pos.y, 3, 3);
    }
    isDead() { return this.lifespan < 0; }
}

// =================================================================
// --- 5. 初始化与窗口响应 ---
// =================================================================
function initializeText() {
    particles = [];
    const cs = CONFIG.TEXT_CHAR_SPACING, ls = CONFIG.TEXT_LINE_SPACING;
    const textBlockWidth = (TEXT_LINES[0].length - 1) * cs;
    const textBlockHeight = (TEXT_LINES.length - 1) * ls;
    const startX = (width - textBlockWidth) / 2;
    const startY = (height - textBlockHeight) / 2 - 100;
    textBounds = { x: startX, y: startY, w: textBlockWidth, h: textBlockHeight };
    for (let y = 0; y < TEXT_LINES.length; y++) {
        for (let x = 0; x < TEXT_LINES[y].length; x++) {
            if (TEXT_LINES[y][x] !== ' ') {
                particles.push(new Particle(TEXT_LINES[y][x], startX + x * cs, startY + y * ls));
            }
        }
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    ground = new Ground(height - CONFIG.GROUND_Y_OFFSET, CONFIG.GROUND_Y_OFFSET);
    initializeText();
    rain = []; flowerClusters = []; harvestSparks = []; ripples = [];
}
