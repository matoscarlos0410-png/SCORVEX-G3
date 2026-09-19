const $ = id => document.getElementById(id);

const canvas = $("game");
const ctx = canvas.getContext("2d");

const SAVE_KEY = "SCORVEX_G3_SAVE";


/* =========================
   SECTORES
========================= */

const sectors = [

  {
    name:"NEON DISTRICT",
    bg:"#071226",
    accent:"#35eaff"
  },

  {
    name:"VOID CANYON",
    bg:"#160d25",
    accent:"#b866ff"
  },

  {
    name:"CRIMSON CORE",
    bg:"#210b17",
    accent:"#ff5377"
  },

  {
    name:"STAR FORTRESS",
    bg:"#091b24",
    accent:"#64ffdc"
  }

];


/* =========================
   ESTADÍSTICAS
========================= */

function baseStats(){

  return {

    level:1,

    score:0,

    coins:80,

    xp:0,

    maxHp:120,

    hp:120,

    maxEnergy:100,

    energy:100,

    damage:20,

    speed:270,

    sector:1,

    wave:1,

    kills:0,

    best:0,

    weapon:"NOVA BLADE",

    dash:0,

    armor:0

  };

}


let stats = load();

let game = null;

let last = performance.now();

let audioOn = true;

let audioCtx = null;


/* =========================
   GUARDAR
========================= */

function load(){

  try{

    return {
      ...baseStats(),
      ...JSON.parse(
        localStorage.getItem(SAVE_KEY)
      )
    };

  }catch{

    return baseStats();

  }

}


function save(){

  stats.best =
    Math.max(
      stats.best,
      stats.score
    );

  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify(stats)
  );

  menuStats();

}


/* =========================
   ESTADÍSTICAS DEL MENÚ
========================= */

function menuStats(){

  $("bestScore").textContent =
    stats.best;

  $("bestZone").textContent =
    stats.sector;

}


/* =========================
   SONIDO
========================= */

function sound(
  frequency = 440,
  duration = .06,
  type = "sine"
){

  if(!audioOn)
    return;

  try{

    audioCtx ??=
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

    if(
      audioCtx.state ===
      "suspended"
    ){

      audioCtx.resume();

    }

    const oscillator =
      audioCtx.createOscillator();

    const gain =
      audioCtx.createGain();

    oscillator.type =
      type;

    oscillator.frequency.value =
      frequency;

    gain.gain.value =
      .035;

    oscillator.connect(gain);

    gain.connect(
      audioCtx.destination
    );

    oscillator.start();

    gain.gain.exponentialRampToValueAtTime(
      .0001,
      audioCtx.currentTime +
      duration
    );

    oscillator.stop(
      audioCtx.currentTime +
      duration
    );

  }catch{}

}


/* =========================
   INICIAR PARTIDA
========================= */

function start(reset = false){

  if(reset){

    stats =
      baseStats();

  }


  game = {

    p:{

      x:600,

      y:350,

      r:18,

      attack:0,

      skill:0,

      dash:0,

      inv:0

    },

    keys:{},

    enemies:[],

    particles:[],

    floating:[],

    spawn:0,

    paused:false,

    running:true,

    killsWave:0,

    mission:5,

    boss:null,

    combo:0,

    comboTimer:0

  };


  $("menu")
    .classList
    .remove("active");

  $("gameScreen")
    .classList
    .add("active");


  last =
    performance.now();


  sound(
    180,
    .12,
    "sawtooth"
  );


  updateHUD();

  requestAnimationFrame(
    loop
  );

}


/* =========================
   CREAR ENEMIGOS
========================= */

function spawn(type = "normal"){

  const side =
    Math.floor(
      Math.random() * 4
    );

  let x;
  let y;


  if(side < 2){

    x =
      Math.random() *
      1200;

    y =
      side === 0
        ? -20
        : 720;

  }else{

    x =
      side === 2
        ? -20
        : 1220;

    y =
      Math.random() *
      700;

  }


  const level =
    stats.level;


  const boss =
    type === "boss";

  const elite =
    type === "elite";


  const hp =
    boss
      ? 550 + level * 100
      : elite
        ? 95 + level * 18
        : 38 + level * 7;


  const enemy = {

    x,

    y,

    r:
      boss
        ? 46
        : elite
          ? 26
          : 17,

    hp,

    max:hp,

    type,

    speed:
      boss
        ? 48
        : elite
          ? 90
          : 110,

    cd:0,

    hit:0,

    phase:
      Math.random() * 6

  };


  game.enemies.push(
    enemy
  );


  if(boss){

    game.boss =
      enemy;

    $("bossUI")
      .classList
      .remove("hidden");

    $("bossName")
      .textContent =
      "OVERLORD G" +
      stats.sector;

  }

}


/* =========================
   PARTÍCULAS
========================= */

function particle(
  x,
  y,
  amount = 8,
  color = "#48eaff"
){

  for(
    let i = 0;
    i < amount;
    i++
  ){

    const angle =
      Math.random() *
      Math.PI *
      2;

    const speed =
      40 +
      Math.random() *
      170;


    game.particles.push({

      x,

      y,

      vx:
        Math.cos(angle) *
        speed,

      vy:
        Math.sin(angle) *
        speed,

      life:
        .35 +
        Math.random() *
        .65,

      color

    });

  }

}


/* =========================
   TEXTO FLOTANTE
========================= */

function floatingText(
  x,
  y,
  value,
  color = "#fff"
){

  game.floating.push({

    x,

    y,

    text:value,

    life:1,

    color

  });

}


/* =========================
   DAÑO AL ENEMIGO
========================= */

function damageEnemy(
  enemy,
  amount
){

  enemy.hp -= amount;

  enemy.hit = .12;


  particle(
    enemy.x,
    enemy.y,
    4
  );


  floatingText(
    enemy.x,
    enemy.y - enemy.r - 8,
    "-" +
    Math.round(amount),
    "#7ff5ff"
  );


  if(enemy.hp <= 0){

    killEnemy(enemy);

  }

}


/* =========================
   ELIMINAR ENEMIGO
========================= */

function killEnemy(enemy){

  const index =
    game.enemies.indexOf(
      enemy
    );


  if(index < 0)
    return;


  game.enemies.splice(
    index,
    1
  );


  const boss =
    enemy.type === "boss";

  const elite =
    enemy.type === "elite";


  stats.kills++;

  game.killsWave++;


  stats.score +=
    boss
      ? 1800
      : elite
        ? 300
        : 100;


  stats.coins +=
    boss
      ? 200
      : elite
        ? 40
        : 12;


  stats.xp +=
    boss
      ? 260
      : elite
        ? 42
        : 13;


  particle(
    enemy.x,
    enemy.y,
    boss
      ? 45
      : elite
        ? 18
        : 10,
    boss
      ? "#ff4f75"
      : "#48eaff"
  );


  sound(
    boss
      ? 80
      : elite
        ? 250
        : 420,

    .08,

    "square"
  );


  /* JEFE DERROTADO */

  if(boss){

    stats.sector =
      Math.min(
        4,
        stats.sector + 1
      );

    stats.wave++;

    stats.hp =
      stats.maxHp;

    stats.energy =
      stats.maxEnergy;

    game.killsWave =
      0;

    game.mission +=
      5;

    game.boss =
      null;

    $("bossUI")
      .classList
      .add("hidden");

  }


  levelCheck();

  save();

  updateHUD();

}


/* =========================
   SUBIR DE NIVEL
========================= */

function levelCheck(){

  while(
    stats.xp >=
    stats.level * 100
  ){

    stats.xp -=
      stats.level * 100;

    stats.level++;

    stats.maxHp +=
      12;

    stats.maxEnergy +=
      8;

    stats.damage +=
      3;

    stats.hp =
      stats.maxHp;

    stats.energy =
      stats.maxEnergy;


    sound(
      780,
      .16,
      "triangle"
    );


    floatingText(
      game.p.x,
      game.p.y - 30,
      "¡NIVEL +1!",
      "#ffd86a"
    );

  }

}


/* =========================
   ATAQUE
========================= */

function attack(){

  if(
    !game ||
    game.paused ||
    game.p.attack > 0
  )
    return;


  game.p.attack =
    .18;


  sound(
    230,
    .045,
    "square"
  );


  const targets =
    game.enemies
      .filter(
        enemy =>
          Math.hypot(
            enemy.x -
            game.p.x,

            enemy.y -
            game.p.y
          ) < 105
      )
      .sort(
        (a,b) =>
          Math.hypot(
            a.x -
            game.p.x,

            a.y -
            game.p.y
          )
          -
          Math.hypot(
            b.x -
            game.p.x,

            b.y -
            game.p.y
          )
      );


  if(targets[0]){

    damageEnemy(
      targets[0],
      stats.damage
    );


    game.combo++;

    game.comboTimer =
      1.5;

  }

}


/* =========================
   HABILIDAD NOVA
========================= */

function nova(){

  if(
    !game ||
    game.paused ||
    game.p.skill > 0 ||
    stats.energy < 30
  )
    return;


  game.p.skill =
    3;


  stats.energy -=
    30;


  sound(
    75,
    .2,
    "sawtooth"
  );


  particle(
    game.p.x,
    game.p.y,
    45,
    "#b05cff"
  );


  game.enemies
    .slice()
    .forEach(
      enemy => {

        const distance =
          Math.hypot(
            enemy.x -
            game.p.x,

            enemy.y -
            game.p.y
          );


        if(distance < 210){

          damageEnemy(
            enemy,
            stats.damage * 2.5
          );

        }

      }
    );

}


/* =========================
   DASH
========================= */

function dash(){

  if(
    !game ||
    game.paused ||
    game.p.dash > 0 ||
    stats.energy < 15
  )
    return;


  let dx =
    (
      game.keys.d ||
      game.keys.ArrowRight
    ? 1
    : 0
    )
    -
    (
      game.keys.a ||
      game.keys.ArrowLeft
    ? 1
    : 0
    );


  let dy =
    (
      game.keys.s ||
      game.keys.ArrowDown
    ? 1
    : 0
    )
    -
    (
      game.keys.w ||
      game.keys.ArrowUp
    ? 1
    : 0
    );


  if(!dx && !dy)
    dx = 1;


  const length =
    Math.hypot(dx,dy);


  game.p.x +=
    dx / length * 125;

  game.p.y +=
    dy / length * 125;


  game.p.x =
    Math.max(
      25,
      Math.min(
        1175,
        game.p.x
      )
    );


  game.p.y =
    Math.max(
      25,
      Math.min(
        675,
        game.p.y
      )
    );


  game.p.dash =
    1.2;


  game.p.inv =
    .35;


  stats.energy -=
    15;


  particle(
    game.p.x,
    game.p.y,
    16,
    "#7e70ff"
  );


  sound(
    600,
    .06,
    "triangle"
  );

}


/* =========================
   ACTUALIZAR JUEGO
========================= */

function update(dt){

  if(game.paused)
    return;


  const player =
    game.p;

  const keys =
    game.keys;


  let dx =
    (
      keys.d ||
      keys.ArrowRight
    ? 1
    : 0
    )
    -
    (
      keys.a ||
      keys.ArrowLeft
    ? 1
    : 0
    );


  let dy =
    (
      keys.s ||
      keys.ArrowDown
    ? 1
    : 0
    )
    -
    (
      keys.w ||
      keys.ArrowUp
    ? 1
    : 0
    );


  if(dx || dy){

    const length =
      Math.hypot(
        dx,
        dy
      );


    player.x +=
      dx /
      length *
      stats.speed *
      dt;


    player.y +=
      dy /
      length *
      stats.speed *
      dt;

  }


  player.x =
    Math.max(
      25,
      Math.min(
        1175,
        player.x
      )
    );


  player.y =
    Math.max(
      25,
      Math.min(
        675,
        player.y
      )
    );


  player.attack =
    Math.max(
      0,
      player.attack - dt
    );


  player.skill =
    Math.max(
      0,
      player.skill - dt
    );


  player.dash =
    Math.max(
      0,
      player.dash - dt
    );


  player.inv =
    Math.max(
      0,
      player.inv - dt
    );


  stats.energy =
    Math.min(
      stats.maxEnergy,
      stats.energy +
      9 * dt
    );


  game.comboTimer -=
    dt;


  if(
    game.comboTimer <= 0
  ){

    game.combo = 0;

  }


  /* SPAWN */

  game.spawn -=
    dt;


  const maxEnemies =
    6 +
    Math.min(
      8,
      stats.level
    );


  if(
    game.spawn <= 0 &&
    game.enemies.length <
      maxEnemies
  ){

    const random =
      Math.random();


    spawn(
      random < .13 &&
      stats.level >= 2
        ? "elite"
        : "normal"
    );


    game.spawn =
      Math.max(
        .35,
        1.05 -
        stats.level *
        .035
      );

  }


  /* MISIÓN */

  if(
    game.killsWave >=
    game.mission &&
    !game.boss
  ){

    game.killsWave = 0;

    game.mission += 5;

    stats.coins += 50;

    stats.score += 250;


    floatingText(
      player.x,
      player.y - 40,
      "MISIÓN COMPLETADA +50 💰",
      "#ffd65a"
    );


    sound(
      900,
      .15,
      "triangle"
    );

  }


  /* JEFE */

  if(
    stats.kills > 0 &&
    stats.kills % 20 === 0 &&
    !game.boss &&
    game.enemies.length <= 2
  ){

    spawn("boss");

  }


  /* ENEMIGOS */

  for(
    const enemy
    of game.enemies
  ){

    enemy.phase +=
      dt;

    enemy.cd =
      Math.max(
        0,
        enemy.cd - dt
      );

    enemy.hit =
      Math.max(
        0,
        enemy.hit - dt
      );


    const ax =
      player.x -
      enemy.x;


    const ay =
      player.y -
      enemy.y;


    const distance =
      Math.hypot(
        ax,
        ay
      ) || 1;


    let speed =
      enemy.speed;


    if(
      enemy.type ===
      "boss"
    ){

      speed *=
        1 +
        Math.sin(
          enemy.phase
        ) * .08;

    }


    enemy.x +=
      ax /
      distance *
      speed *
      dt;


    enemy.y +=
      ay /
      distance *
      speed *
      dt;


    if(
      distance <
        enemy.r +
        player.r +
        5 &&
      enemy.cd <= 0 &&
      player.inv <= 0
    ){

      stats.hp -=
        enemy.type === "boss"
          ? 16
          : enemy.type === "elite"
            ? 9
            : 6;


      enemy.cd =
        enemy.type === "boss"
          ? 1.1
          : .7;


      player.inv =
        .4;


      sound(
        100,
        .05,
        "sawtooth"
      );


      if(
        stats.hp <= 0
      ){

        respawn();

      }

    }

  }


  /* PARTÍCULAS */

  for(
    const particle
    of game.particles
  ){

    particle.x +=
      particle.vx *
      dt;

    particle.y +=
      particle.vy *
      dt;


    particle.vx *=
      .95;

    particle.vy *=
      .95;


    particle.life -=
      dt;

  }


  game.particles =
    game.particles.filter(
      p =>
        p.life > 0
    );


  /* TEXTOS */

  for(
    const item
    of game.floating
  ){

    item.y -=
      25 * dt;

    item.life -=
      dt;

  }


  game.floating =
    game.floating.filter(
      item =>
        item.life > 0
    );


  updateHUD();

}


/* =========================
   RESPAWN
========================= */

function respawn(){

  stats.hp =
    stats.maxHp;

  stats.energy =
    stats.maxEnergy;

  stats.score =
    Math.max(
      0,
      stats.score - 250
    );

  stats.coins =
    Math.max(
      0,
      stats.coins - 30
    );


  game.enemies =
    [];

  game.boss =
    null;


  $("bossUI")
    .classList
    .add("hidden");


  floatingText(
    game.p.x,
    game.p.y,
    "REINICIANDO...",
    "#ff6688"
  );


  sound(
    90,
    .15,
    "sawtooth"
  );


  save();

}


/* =========================
   DIBUJAR
========================= */

function draw(){

  const sector =
    sectors[
      stats.sector - 1
    ];


  /* FONDO */

  ctx.fillStyle =
    sector.bg;

  ctx.fillRect(
    0,
    0,
    1200,
    700
  );


  /* LUZ */

  const gradient =
    ctx.createRadialGradient(
      600,
      350,
      20,
      600,
      350,
      600
    );


  gradient.addColorStop(
    0,
    sector.accent +
    "22"
  );


  gradient.addColorStop(
    1,
    "transparent"
  );


  ctx.fillStyle =
    gradient;

  ctx.fillRect(
    0,
    0,
    1200,
    700
  );


  /* GRID */

  ctx.globalAlpha =
    .32;

  ctx.strokeStyle =
    sector.accent;


  for(
    let x = -700;
    x < 1300;
    x += 50
  ){

    ctx.beginPath();

    ctx.moveTo(
      x,
      0
    );

    ctx.lineTo(
      x + 700,
      700
    );

    ctx.stroke();

  }


  for(
    let y = 0;
    y < 700;
    y += 50
  ){

    ctx.beginPath();

    ctx.moveTo(
      0,
      y
    );

    ctx.lineTo(
      1200,
      y
    );

    ctx.stroke();

  }


  ctx.globalAlpha =
    1;


  /* ENEMIGOS */

  for(
    const enemy
    of game.enemies
  ){

    drawEnemy(
      enemy,
      sector.accent
    );

  }


  /* JUGADOR */

  const player =
    game.p;


  ctx.save();

  ctx.translate(
    player.x,
    player.y
  );


  let angle =
    Math.atan2(

      (
        game.keys.s ||
        game.keys.ArrowDown
      ? 1
      : 0
      )
      -
      (
        game.keys.w ||
        game.keys.ArrowUp
      ? 1
      : 0
      ),

      (
        game.keys.d ||
        game.keys.ArrowRight
      ? 1
      : 0
      )
      -
      (
        game.keys.a ||
        game.keys.ArrowLeft
      ? 1
      : 0
      )

    );


  if(!isFinite(angle))
    angle = 0;


  ctx.rotate(
    angle +
    Math.PI / 2
  );


  ctx.shadowBlur =
    25;

  ctx.shadowColor =
    "#39eaff";


  ctx.fillStyle =
    player.inv > 0
      ? "#ffffff"
      : "#40e8ff";


  ctx.beginPath();

  ctx.moveTo(
    0,
    -28
  );

  ctx.lineTo(
    19,
    18
  );

  ctx.lineTo(
    0,
    10
  );

  ctx.lineTo(
    -19,
    18
  );

  ctx.closePath();

  ctx.fill();


  ctx.fillStyle =
    "#101832";


  ctx.beginPath();

  ctx.arc(
    0,
    0,
    7,
    0,
    Math.PI * 2
  );

  ctx.fill();


  ctx.restore();


  /* PARTÍCULAS */

  for(
    const item
    of game.particles
  ){

    ctx.globalAlpha =
      Math.max(
        0,
        item.life
      );

    ctx.fillStyle =
      item.color;

    ctx.beginPath();

    ctx.arc(
      item.x,
      item.y,
      2.5 +
      3 *
      item.life,
      0,
      Math.PI * 2
    );

    ctx.fill();

  }


  ctx.globalAlpha =
    1;


  /* TEXTOS */

  for(
    const item
    of game.floating
  ){

    ctx.globalAlpha =
      Math.max(
        0,
        item.life
      );

    ctx.fillStyle =
      item.color;

    ctx.font =
      "bold 13px Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      item.text,
      item.x,
      item.y
    );

  }


  ctx.globalAlpha =
    1;


  /* PAUSA */

  if(game.paused){

    ctx.fillStyle =
      "#01030acc";

    ctx.fillRect(
      0,
      0,
      1200,
      700
    );


    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      "bold 48px Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      "PAUSA",
      600,
      330
    );


    ctx.font =
      "12px Arial";

    ctx.fillStyle =
      "#7d8dab";

    ctx.fillText(
      "Presiona P para continuar",
      600,
      360
    );

  }

}


/* =========================
   DIBUJAR ENEMIGO
========================= */

function drawEnemy(
  enemy,
  accent
){

  ctx.save();

  ctx.translate(
    enemy.x,
    enemy.y
  );


  ctx.rotate(
    enemy.phase * .5
  );


  ctx.shadowBlur =
    enemy.type === "boss"
      ? 35
      : 18;


  ctx.shadowColor =
    enemy.type === "boss"
      ? "#ff416c"
      : enemy.type === "elite"
        ? "#ad5cff"
        : accent;


  ctx.fillStyle =
    enemy.hit > 0
      ? "#ffffff"
      : enemy.type === "boss"
        ? "#ff3e69"
        : enemy.type === "elite"
          ? "#a65cff"
          : "#ef405e";


  ctx.beginPath();


  for(
    let i = 0;
    i < 6;
    i++
  ){

    const angle =
      i *
      Math.PI /
      3;


    ctx.lineTo(
      Math.cos(angle) *
      enemy.r,

      Math.sin(angle) *
      enemy.r
    );

  }


  ctx.closePath();

  ctx.fill();


  ctx.strokeStyle =
    "#ffd2dc";

  ctx.stroke();


  ctx.restore();


  /* VIDA ENEMIGO */

  ctx.fillStyle =
    "#111";

  ctx.fillRect(
    enemy.x -
      enemy.r,

    enemy.y -
      enemy.r -
      10,

    enemy.r * 2,

    4
  );


  ctx.fillStyle =
    enemy.type === "boss"
      ? "#ff4b68"
      : "#4deaff";


  ctx.fillRect(

    enemy.x -
      enemy.r,

    enemy.y -
      enemy.r -
      10,

    enemy.r *
      2 *
      Math.max(
        0,
        enemy.hp /
        enemy.max
      ),

    4

  );

}


/* =========================
   ACTUALIZAR HUD
========================= */

function updateHUD(){

  const xpNeed =
    stats.level * 100;


  $("level").textContent =
    stats.level;


  $("score").textContent =
    stats.score;


  $("coins").textContent =
    stats.coins;


  $("combo").textContent =
    game?.combo || 0;


  $("hpText").textContent =
    `${Math.max(
      0,
      Math.round(stats.hp)
    )} / ${stats.maxHp}`;


  $("energyText").textContent =
    `${Math.round(
      stats.energy
    )} / ${stats.maxEnergy}`;


  $("xpText").textContent =
    `${stats.xp} / ${xpNeed}`;


  $("hpBar").style.width =
    Math.max(
      0,
      stats.hp /
      stats.maxHp *
      100
    ) + "%";


  $("energyBar").style.width =
    stats.energy /
    stats.maxEnergy *
    100 +
    "%";


  $("xpBar").style.width =
    Math.min(
      100,
      stats.xp /
      xpNeed *
      100
    ) + "%";


  $("zoneName").textContent =
    `SECTOR ${
      String(stats.sector)
        .padStart(2,"0")
    }`;


  $("sectorBanner").textContent =
    `SECTOR ${
      String(stats.sector)
        .padStart(2,"0")
    } · ${
      sectors[
        stats.sector - 1
      ].name
    }`;


  $("waveText").textContent =
    `OLEADA ${stats.wave}`;


  $("missionText").textContent =
    `Derrota ${
      game?.mission || 5
    } enemigos`;


  $("missionProgress").textContent =
    `${
      game?.killsWave || 0
    } / ${
      game?.mission || 5
    }`;


  $("skillCd").textContent =
    game?.p.skill > 0
      ? game.p.skill.toFixed(1) +
        "s"
      : "LISTO";


  if(stats.level >= 10){

    $("playerRank")
      .textContent =
      "LEYENDA";

  }else if(stats.level >= 6){

    $("playerRank")
      .textContent =
      "VETERANO";

  }else if(stats.level >= 3){

    $("playerRank")
      .textContent =
      "GUARDIÁN";

  }else{

    $("playerRank")
      .textContent =
      "RECLUTA";

  }


  $("menuSector").textContent =
    String(
      stats.sector
    ).padStart(
      2,
      "0"
    );


  menuStats();


  if(game?.boss){

    $("bossBar").style.width =
      Math.max(
        0,
        game.boss.hp /
        game.boss.max *
        100
      ) + "%";

  }

}


/* =========================
   LOOP
========================= */

function loop(time){

  if(!game)
    return;


  const dt =
    Math.min(
      .033,
      (time - last) /
      1000
    );


  last =
    time;


  update(dt);

  draw();


  if(game.running){

    requestAnimationFrame(
      loop
    );

  }

}


/* =========================
   MODAL
========================= */

function modal(
  title,
  html
){

  $("modalTitle")
    .textContent =
    title;

  $("modalBody")
    .innerHTML =
    html;

  $("modal")
    .classList
    .remove("hidden");

}


/* =========================
   TIENDA
========================= */

function shop(){

  modal(
    "MEJORAS G3",

    `
    <div class="shop-item">

      <div>
        ❤️ BOTIQUÍN

        <small>
          Recupera 45 HP
        </small>
      </div>

      <button
        data-buy="heal">
        40 💰
      </button>

    </div>


    <div class="shop-item">

      <div>
        ⚔️ NÚCLEO DE DAÑO

        <small>
          +5 daño permanente
        </small>
      </div>

      <button
        data-buy="damage">
        90 💰
      </button>

    </div>


    <div class="shop-item">

      <div>
        🛡️ ARMADURA

        <small>
          +30 HP máximo
        </small>
      </div>

      <button
        data-buy="hp">
        110 💰
      </button>

    </div>


    <div class="shop-item">

      <div>
        ⚡ REACTOR

        <small>
          +25 energía máxima
        </small>
      </div>

      <button
        data-buy="energy">
        100 💰
      </button>

    </div>


    <div class="shop-item">

      <div>
        🏃 MOTOR

        <small>
          +20 velocidad
        </small>
      </div>

      <button
        data-buy="speed">
        120 💰
      </button>

    </div>
    `
  );


  document
    .querySelectorAll(
      "[data-buy]"
    )
    .forEach(
      button => {

        button.onclick =
          () =>
            buy(
              button.dataset.buy
            );

      }
    );

}


/* =========================
   COMPRAR
========================= */

function buy(type){

  const costs = {

    heal:40,

    damage:90,

    hp:110,

    energy:100,

    speed:120

  };


  const cost =
    costs[type];


  if(
    stats.coins <
    cost
  ){

    sound(
      70,
      .1
    );

    return;

  }


  stats.coins -=
    cost;


  if(type === "heal"){

    stats.hp =
      Math.min(
        stats.maxHp,
        stats.hp + 45
      );

  }


  if(type === "damage"){

    stats.damage +=
      5;

  }


  if(type === "hp"){

    stats.maxHp +=
      30;

    stats.hp =
      stats.maxHp;

  }


  if(type === "energy"){

    stats.maxEnergy +=
      25;

    stats.energy =
      stats.maxEnergy;

  }


  if(type === "speed"){

    stats.speed +=
      20;

  }


  save();

  updateHUD();


  sound(
    720,
    .08,
    "triangle"
  );

}


/* =========================
   INVENTARIO
========================= */

function inventory(){

  modal(

    "INVENTARIO G3",

    `
    <div class="inv-item">

      <div>

        ⚔️
        <b>
          ${stats.weapon}
        </b>

        <small>
          Daño actual:
          ${stats.damage}
        </small>

      </div>

      <span>
        EQUIPADO
      </span>

    </div>


    <div class="inv-item">

      <div>

        🛡️ ARMADURA

        <small>
          Protección integrada
        </small>

      </div>

      <span>
        +${
          stats.maxHp - 120
        } HP
      </span>

    </div>


    <div class="inv-item">

      <div>

        ⚡ REACTOR

        <small>
          Energía máxima
        </small>

      </div>

      <span>
        ${stats.maxEnergy}
      </span>

    </div>


    <div class="notice">

      Completa sectores y
      derrota jefes para hacer
      crecer tu equipamiento.

    </div>
    `

  );

}


/* =========================
   CONTROLES
========================= */

$("controlsBtn").onclick =
  () => {

    modal(

      "CONTROLES",

      `
      <div class="grid">

        <div class="control">
          <b>W A S D / FLECHAS</b>
          <br>
          Mover personaje
        </div>

        <div class="control">
          <b>ESPACIO</b>
          <br>
          Ataque cercano
        </div>

        <div class="control">
          <b>E</b>
          <br>
          NOVA: ataque de área
        </div>

        <div class="control">
          <b>SHIFT</b>
          <br>
          Dash rápido
        </div>

        <div class="control">
          <b>P</b>
          <br>
          Pausa
        </div>

        <div class="control">
          <b>🛒</b>
          <br>
          Comprar mejoras
        </div>

      </div>
      `

    );

  };


/* =========================
   BOTONES
========================= */

$("playBtn").onclick =
  () => start(true);


$("continueBtn").onclick =
  () => start(false);


$("shopBtn").onclick =
  shop;


$("inventoryBtn").onclick =
  inventory;


$("closeModal").onclick =
  () =>
    $("modal")
      .classList
      .add("hidden");


$("modal").onclick =
  event => {

    if(
      event.target ===
      $("modal")
    ){

      $("modal")
        .classList
        .add("hidden");

    }

  };


/* =========================
   PAUSA
========================= */

$("pauseBtn").onclick =
  () => {

    if(game){

      game.paused =
        !game.paused;

    }

  };


/* =========================
   VOLVER AL MENÚ
========================= */

$("menuBtn").onclick =
  () => {

    if(game)
      save();


    game = null;


    $("gameScreen")
      .classList
      .remove("active");


    $("menu")
      .classList
      .add("active");

  };


/* =========================
   SONIDO
========================= */

$("soundBtn").onclick =
  () => {

    audioOn =
      !audioOn;


    $("soundBtn")
      .textContent =
      audioOn
        ? "🔊"
        : "🔇";

  };


/* =========================
   REINICIAR DATOS
========================= */

$("resetBtn").onclick =
  () => {

    if(
      confirm(
        "¿Reiniciar todo el progreso de SCORVEX G3?"
      )
    ){

      localStorage.removeItem(
        SAVE_KEY
      );


      stats =
        baseStats();


      menuStats();

      updateHUD();

    }

  };


/* =========================
   TECLADO
========================= */

addEventListener(
  "keydown",
  event => {

    if(!game)
      return;


    game.keys[
      event.key
    ] = true;


    if(
      event.code ===
      "Space"
    ){

      event.preventDefault();

      attack();

    }


    if(
      event.key.toLowerCase()
      === "e"
    ){

      nova();

    }


    if(
      event.key ===
      "Shift"
    ){

      dash();

    }


    if(
      event.key.toLowerCase()
      === "p"
    ){

      game.paused =
        !game.paused;

    }

  }
);


addEventListener(
  "keyup",
  event => {

    if(game){

      game.keys[
        event.key
      ] = false;

    }

  }
);


/* =========================
   GUARDAR AL SALIR
========================= */

window.addEventListener(
  "beforeunload",
  () => {

    if(game)
      save();

  }
);


/* =========================
   INICIO
========================= */

setTimeout(
  () => {

    $("boot")
      .remove();

  },
  650
);


menuStats();

updateHUD();
