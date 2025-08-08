const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const btnPlay = document.getElementById('btn-play');
const btnAudio = document.getElementById('btn-audio');
const audioIcon = document.getElementById('audio-icon');
const healthFill = document.getElementById('health-fill');
const coinsEl = document.getElementById('coins');
const gemsEl = document.getElementById('gems');

const scene = document.getElementById('scene');
const ctx = scene.getContext('2d');
let width = scene.width;
let height = scene.height;

let t = 0;
let running = false;
let audioOn = true;
let health = 1; // 0..1
let coins = 0;
let gems = 0;
let wave = 0;

// Asset images
const imgTiles = {
  grass: load('../assets/tiles/grass.svg'),
  dirt: load('../assets/tiles/dirt.svg'),
  stone: load('../assets/tiles/stone.svg'),
  water: load('../assets/tiles/water.svg'),
};
const imgSprites = {
  coin: load('../assets/sprites/common/coin.svg'),
  gem: load('../assets/sprites/common/gem.svg'),
};

function load(src){
  const img = new Image();
  img.src = src;
  return img;
}

function resize(){
  const ratio = window.devicePixelRatio || 1;
  const rect = scene.getBoundingClientRect();
  scene.width = Math.floor(rect.width * ratio);
  scene.height = Math.floor(rect.height * ratio);
  width = scene.width; height = scene.height;
  ctx.setTransform(ratio,0,0,ratio,0,0); // draw in CSS pixels
}
window.addEventListener('resize', resize);
resize();

function animate(){
  if(!running){
    requestAnimationFrame(animate);
    return;
  }
  t += 0.016;
  wave += 0.005;

  // Parallax offset via CSS backgrounds
  const clouds = document.querySelector('.bg.layer.clouds');
  const mBack = document.querySelector('.bg.layer.mountains-back');
  const mFront = document.querySelector('.bg.layer.mountains-front');
  clouds.style.backgroundPosition = `${-t*30}px 0px`;
  mBack.style.backgroundPosition = `${-t*8}px bottom`;
  mFront.style.backgroundPosition = `${-t*16}px calc(100% - 20px)`;

  // Scene
  ctx.clearRect(0,0,width,height);

  // Ground tiles
  const tileSize = 32;
  const cols = Math.ceil(width / tileSize) + 1;
  const groundY = Math.floor(height*0.75);

  // water strip with wave offset
  const waterOffset = Math.sin(wave*2)*8;
  for(let x=0; x<cols; x++){
    ctx.drawImage(imgTiles.water, x*tileSize, groundY - tileSize + waterOffset, tileSize, tileSize);
  }

  // dirt base
  for(let y=0; y<4; y++){
    for(let x=0; x<cols; x++){
      ctx.drawImage(imgTiles.dirt, x*tileSize, groundY + y*tileSize, tileSize, tileSize);
    }
  }

  // grass top
  for(let x=0; x<cols; x++){
    ctx.drawImage(imgTiles.grass, x*tileSize, groundY - tileSize, tileSize, tileSize);
  }

  // sparkle items
  const coinX = (Math.sin(t*0.7)*0.5+0.5)*(width-200)+100;
  const coinY = groundY - 96 + Math.sin(t*3)*4;
  ctx.save();
  ctx.translate(coinX, coinY);
  ctx.drawImage(imgSprites.coin, -32, -32, 64, 64);
  ctx.restore();

  const gemX = (Math.sin(t*0.9+2)*0.5+0.5)*(width-200)+100;
  const gemY = groundY - 120 + Math.sin(t*2.4)*6;
  ctx.save();
  ctx.translate(gemX, gemY);
  ctx.drawImage(imgSprites.gem, -32, -32, 64, 64);
  ctx.restore();

  requestAnimationFrame(animate);
}

btnPlay.addEventListener('click', ()=>{
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  running = true;
  // demo counters and health decay/regeneration
  let dir = -1;
  setInterval(()=>{
    health += 0.05*dir;
    if(health <= 0.15){ dir = 1; }
    if(health >= 1){ dir = -1; }
    setHealth(health);
  }, 200);
  setInterval(()=>{ coins += 1; coinsEl.textContent = String(coins); }, 1200);
  setInterval(()=>{ gems += 1; gemsEl.textContent = String(gems); }, 2600);
  requestAnimationFrame(animate);
});

btnAudio.addEventListener('click', ()=>{
  audioOn = !audioOn;
  audioIcon.src = audioOn ? '../assets/ui/icons/sound-on.svg' : '../assets/ui/icons/sound-off.svg';
});

function setHealth(v){
  const clamped = Math.max(0, Math.min(1, v));
  healthFill.style.transform = `scaleX(${clamped})`;
}
setHealth(1);