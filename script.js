// ——— Audio Setup ———
const sounds = {
  shoot:      new Audio('assets/sounds/shoot.wav'),
  explosion: new Audio('assets/sounds/explosion.mp3'),
  powerup:   new Audio('assets/sounds/powerup.wav'),
  bgMusic:   new Audio('assets/sounds/bg_music.mp3'),
};
sounds.bgMusic.loop = true;
sounds.bgMusic.volume = 0.5;

function playSound(sound) {
  const s = sound.cloneNode();
  s.play();
}
// ——— End Audio Setup ———

const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreboardDiv = document.getElementById('scoreboard');
    const powerupsDiv = document.getElementById('powerups');
    const startscreen = document.getElementById('startscreen');
    const gameover = document.getElementById('gameover');
    const levelup = document.getElementById('levelup');
    const activePowerupsContainer = document.getElementById('active-powerups');
    const scoreboard = { score:0, level:1, highscore:localStorage.getItem('highscore')||0, health:5 };
    let gameStarted=false, gameOver=false;
    
    // Enhanced player object with engine effects
    const player={
      x:canvas.width/2, 
      y:canvas.height-80, 
      size:25, 
      baseSpeed:5, 
      speed:5, 
      bullets:[], 
      spread:false, 
      invincible:false, 
      infiniteRange:false, 
      flashing:false,
      engineParticles: [],
      lastShot: 0
    };
    
    // Game objects
    const enemies=[], enemyBullets=[], powerUps=[];
    const activePowerUps=[], pointsText=[], explosions=[], particles=[];
    
    // Game settings
    let damageFreePoints=0, nextScorePowerThreshold=500;
    
    // Enhanced starfield with different sizes and colors
    let stars=Array.from({length:200},()=>({ 
      x:Math.random()*canvas.width, 
      y:Math.random()*canvas.height, 
      size:Math.random()*2+0.5, 
      speed:Math.random()*3+1,
      color: `hsl(${Math.random()*60 + 200}, 80%, ${Math.random()*30 + 50}%)`
    }));

    // ——— Fullscreen Helper ———
    function openFullscreen() {
      const el = document.documentElement;
      if (el.requestFullscreen)        el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen)     el.msRequestFullscreen();
    }
    // ——— End Fullscreen Helper ———
    
    // Touch‐start listener (only once) to open fullscreen + start/reset
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      openFullscreen();
      if (!gameStarted)       startGame();
      else if (gameOver)      resetGame();
    }, { once: true });

    // Input handling
    let keys={}, canShoot=true, enemyInterval;
    let shieldPulse = 0;
    let lastPowerupUpdate = 0;
    let frameCount = 0;

    function startGame(){ 
      gameStarted=true; 
      resetGame();     
      scoreboardDiv.style.display='block'; 
      powerupsDiv.style.display='block'; 
      startscreen.style.display='none'; 
      // ——— Start BGM on first game start ———
      sounds.bgMusic.currentTime = 0;
      sounds.bgMusic.play();
    }
    
    function resetGame(){
  // Restart background music on game reset
  sounds.bgMusic.currentTime = 0;
  sounds.bgMusic.play();
      // Reset player
      Object.assign(player,{ 
        x:canvas.width/2, 
        y:canvas.height-80, 
        bullets:[], 
        speed:player.baseSpeed, 
        spread:false, 
        invincible:false, 
        infiniteRange:false, 
        flashing:false,
        engineParticles: [],
        lastShot: 0
      });
      
      // Clear all game objects
      enemies.length=0; 
      enemyBullets.length=0; 
      powerUps.length=0; 
      pointsText.length=0; 
      activePowerUps.length=0; 
      explosions.length=0;
      particles.length=0;
      
      // Reset scoreboard
      scoreboard.score=0;
      scoreboard.level=1;
      scoreboard.health=5;
      damageFreePoints=0;
      nextScorePowerThreshold=500;
      
      // Update UI
      document.getElementById('score').textContent='0';
      document.getElementById('level').textContent='1';
      document.getElementById('health').textContent='5';
      activePowerupsContainer.innerHTML = '';
      
      // Reset game state
      gameOver=false;
      gameover.style.display='none';
      levelup.style.display='none';
      
      // Start enemy spawning
      clearInterval(enemyInterval);
      enemyInterval=setInterval(spawnEnemy,800);
      spawnEnemy();
      
      // Start game loop
      requestAnimationFrame(gameLoop);
    }

    function spawnEnemy(){
      const size=Math.random()*25+15;
      const speed=Math.random()*2+2+scoreboard.level*0.3;
      const isShooter=Math.random()<0.3;
      const stopY=isShooter?Math.random()*(canvas.height*0.5)+canvas.height*0.2:null;
      const type = Math.floor(Math.random() * 3); // 3 different enemy types
      
      enemies.push({ 
        x:Math.random()*(canvas.width-size), 
        y:-size, 
        size, 
        speed, 
        isShooter, 
        stopY, 
        stopped:false, 
        shootCooldown:60,
        type,
        frame: 0,
        engineParticles: []
      });
    }
    
    function spawnPowerUp(){
      const types=['health','spread','invincible','infiniteRange'];
      const type=types[Math.floor(Math.random()*types.length)];
      const colors = {
        'health': '#f44',
        'spread': '#4f4',
        'invincible': '#4af',
        'infiniteRange': '#ff0'
      };
      
      powerUps.push({ 
        x:Math.random()*(canvas.width-20)+10, 
        y:Math.random()*(canvas.height-200)+50, 
        size:12, 
        type, 
        createTime:Date.now(), 
        flash:true,
        color: colors[type],
        rotation: 0
      });
    }

    function triggerPlayerFlash(){ 
      for(let i=0;i<4;i++) setTimeout(()=>player.flashing=!player.flashing,i*200); 
    }

    function drawPlayer(){ 
      // Draw engine glow
      ctx.save();
      const gradient = ctx.createRadialGradient(
        player.x, player.y + player.size, 0,
        player.x, player.y + player.size, player.size*2
      );
      gradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + player.size, player.size/1.5, player.size*1.5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
      
      // Draw engine particles
      player.engineParticles.forEach((p, i) => {
        ctx.fillStyle = `rgba(100, 200, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
        p.y += p.speed;
        p.alpha -= 0.02;
        if(p.alpha <= 0) player.engineParticles.splice(i, 1);
      });
      
      // Draw player ship
      ctx.save();
      if(player.flashing) ctx.fillStyle = '#f44';
      else ctx.fillStyle = player.invincible ? '#4af' : '#4df';
      
      ctx.beginPath();
      // Sleeker ship design
      ctx.moveTo(player.x, player.y - player.size);
      ctx.lineTo(player.x - player.size/1.5, player.y + player.size/3);
      ctx.lineTo(player.x - player.size/4, player.y + player.size/2);
      ctx.lineTo(player.x, player.y + player.size/1.5);
      ctx.lineTo(player.x + player.size/4, player.y + player.size/2);
      ctx.lineTo(player.x + player.size/1.5, player.y + player.size/3);
      ctx.closePath();
      ctx.fill();
      
      // Ship details
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw shield if invincible
      if(player.invincible) {
        shieldPulse = (shieldPulse + 0.05) % (Math.PI * 2);
        const shieldSize = player.size * 1.8 + Math.sin(shieldPulse * 3) * 5;
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.6 + Math.sin(shieldPulse) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, shieldSize, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    
    function drawEnemies(){ 
      enemies.forEach(e=>{
        // Update animation frame
        e.frame = (e.frame + 0.1) % 4;
        
        // Draw engine glow
        ctx.save();
        const gradient = ctx.createRadialGradient(
          e.x, e.y + e.size, 0,
          e.x, e.y + e.size, e.size*1.5
        );
        gradient.addColorStop(0, e.isShooter ? 'rgba(255, 100, 200, 0.6)' : 'rgba(100, 255, 100, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.size, e.size/2, e.size, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        
        // Draw engine particles
        e.engineParticles.forEach((p, i) => {
          ctx.fillStyle = e.isShooter ? `rgba(255, 100, 200, ${p.alpha})` : `rgba(100, 255, 100, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
          ctx.fill();
          p.y += p.speed;
          p.alpha -= 0.02;
          if(p.alpha <= 0) e.engineParticles.splice(i, 1);
        });
        
        // Draw different enemy types
        ctx.save();
        ctx.fillStyle = e.isShooter ? '#f5a' : '#5f5';
        
        // Enemy type 0 - basic fighter
        if(e.type === 0) {
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.size/1.5);
          ctx.lineTo(e.x - e.size/2, e.y + e.size/3);
          ctx.lineTo(e.x - e.size/4, e.y + e.size/2);
          ctx.lineTo(e.x, e.y + e.size/1.5);
          ctx.lineTo(e.x + e.size/4, e.y + e.size/2);
          ctx.lineTo(e.x + e.size/2, e.y + e.size/3);
          ctx.closePath();
        } 
        // Enemy type 1 - interceptor
        else if(e.type === 1) {
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.size/1.2);
          ctx.lineTo(e.x - e.size/2, e.y);
          ctx.lineTo(e.x - e.size/3, e.y + e.size/3);
          ctx.lineTo(e.x, e.y + e.size/1.5);
          ctx.lineTo(e.x + e.size/3, e.y + e.size/3);
          ctx.lineTo(e.x + e.size/2, e.y);
          ctx.closePath();
        }
        // Enemy type 2 - bomber
        else {
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.size/2);
          ctx.lineTo(e.x - e.size/2, e.y - e.size/4);
          ctx.lineTo(e.x - e.size/1.5, e.y + e.size/3);
          ctx.lineTo(e.x, e.y + e.size/1.2);
          ctx.lineTo(e.x + e.size/1.5, e.y + e.size/3);
          ctx.lineTo(e.x + e.size/2, e.y - e.size/4);
          ctx.closePath();
        }
        
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      });
    }
    
    function drawExplosions(){
      explosions.forEach((ex,i)=>{
        const size = ex.frame * 5;
        const alpha = 1 - ex.frame/15;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Core
        ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, size/2, 0, Math.PI*2);
        ctx.fill();
        
        // Outer ring
        ctx.strokeStyle = `rgba(255, 100, 50, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, size, 0, Math.PI*2);
        ctx.stroke();
        
        // Particles
        for(let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI*2;
          const dist = Math.random() * size;
          ctx.fillStyle = `rgba(255, ${150 + Math.random()*100}, 50, ${alpha})`;
          ctx.beginPath();
          ctx.arc(
            ex.x + Math.cos(angle) * dist,
            ex.y + Math.sin(angle) * dist,
            Math.random() * 3 + 1,
            0, Math.PI*2
          );
          ctx.fill();
        }
        
        ctx.restore();
        
        ex.frame += 0.5;
        if(ex.frame > 15) explosions.splice(i,1);
      });
    }
    
    function drawPowerUps(){ 
      powerUps.forEach(p=>{ 
        p.rotation += 0.02;
        
        if(p.flash){
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          
          // Glow effect
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size*2);
          gradient.addColorStop(0, p.color);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, p.size*2, 0, Math.PI*2);
          ctx.fill();
          
          // Power-up icon
          ctx.fillStyle = p.color;
          
          switch(p.type) {
            case 'health':
              // Heart shape
              ctx.beginPath();
              ctx.moveTo(0, -p.size/2);
              ctx.bezierCurveTo(p.size/2, -p.size, p.size, 0, 0, p.size/2);
              ctx.bezierCurveTo(-p.size, 0, -p.size/2, -p.size, 0, -p.size/2);
              ctx.fill();
              break;
            case 'spread':
              // Three dots
              ctx.beginPath();
              ctx.arc(-p.size/2, 0, p.size/3, 0, Math.PI*2);
              ctx.arc(0, 0, p.size/3, 0, Math.PI*2);
              ctx.arc(p.size/2, 0, p.size/3, 0, Math.PI*2);
              ctx.fill();
              break;
            case 'invincible':
              // Shield
              ctx.beginPath();
              ctx.arc(0, 0, p.size, 0, Math.PI, true);
              ctx.lineTo(0, -p.size/2);
              ctx.lineTo(p.size, 0);
              ctx.fill();
              break;
            case 'infiniteRange':
              // Infinity symbol
              ctx.beginPath();
              ctx.arc(-p.size/3, 0, p.size/3, 0, Math.PI, true);
              ctx.arc(p.size/3, 0, p.size/3, Math.PI, 0, true);
              ctx.lineWidth = 2;
              ctx.strokeStyle = p.color;
              ctx.stroke();
              break;
          }
          
          ctx.restore();
        }
      });
    }

    function updatePowerupsDisplay(now) {
      if (now - lastPowerupUpdate < 100) return;
      lastPowerupUpdate = now;
      
      if (activePowerUps.length === 0) {
        activePowerupsContainer.innerHTML = '<div class="powerup-item">None</div>';
        return;
      }
      
      activePowerupsContainer.innerHTML = '';
      activePowerUps.forEach(pu => {
        const remaining = Math.max(0, (pu.expire - now) / 1000);
        const item = document.createElement('div');
        item.className = 'powerup-item';
        
        switch(pu.type) {
          case 'spread':
            item.innerHTML = `Triple Shot: <span class="powerup-time">${remaining.toFixed(1)}s</span>`;
            break;
          case 'invincible':
            item.innerHTML = `Bullet Shield: <span class="powerup-time">${remaining.toFixed(1)}s</span>`;
            break;
          case 'infiniteRange':
            item.innerHTML = `Infinite Range: <span class="powerup-time">${remaining.toFixed(1)}s</span>`;
            break;
        }
        
        if (remaining < 3) {
          item.style.animation = 'flash 0.5s step-end infinite alternate';
        } else {
          item.style.animation = '';
        }
        
        activePowerupsContainer.appendChild(item);
      });
    }

    function update(){
      const now=Date.now();
      frameCount++;
      updatePowerupsDisplay(now);
      
      // Add engine particles to player
      if(frameCount % 3 === 0) {
        player.engineParticles.push({
          x: player.x + (Math.random() * player.size/2 - player.size/4),
          y: player.y + player.size/1.5,
          size: Math.random() * 2 + 1,
          speed: Math.random() * 2 + 1,
          alpha: 0.7
        });
      }
      
      // Update power-ups flashing state
      powerUps.forEach((p,i)=>{
        const age=now-p.createTime;
        if(age>=10000) powerUps.splice(i,1);
        else if(age>=5000) p.flash = Math.floor((age-5000)/500)%2===0;
        else p.flash=true;
      });
      
      // Check for expired power-ups
      let powerupsChanged = false;
      activePowerUps.forEach((pu,i)=>{ 
        if(now>pu.expire){
          if(pu.type==='spread') player.spread=false;
          if(pu.type==='invincible') player.invincible=false;
          if(pu.type==='infiniteRange') player.infiniteRange=false;
          activePowerUps.splice(i,1);
          powerupsChanged = true;
        }
      });
      if(powerupsChanged) updatePowerupsDisplay(now);
      
      // Update explosions
      explosions.forEach((ex,i)=>{ ex.frame++; if(ex.frame>15) explosions.splice(i,1); });
      
      // Update stars background
      stars.forEach(s=>{
        s.y+=s.speed;
        if(s.y>canvas.height) {
          s.y = 0;
          s.x = Math.random() * canvas.width;
        }
      });
      
      // Update player position
      updatePlayer();
      
      // Update player bullets with trail effect
      player.bullets.forEach(b=>{
        b.x+=b.vx;
        b.y+=b.vy;
        
        // Add bullet trail particles
        if(frameCount % 2 === 0) {
          particles.push({
            x: b.x,
            y: b.y + 5,
            size: Math.random() * 1.5 + 0.5,
            alpha: 0.7,
            color: '#ff0'
          });
        }
      });
      player.bullets=player.bullets.filter(b=>player.infiniteRange||(b.startY-b.y<canvas.height/2));
      
      // Update enemy bullets with trail effect
      enemyBullets.forEach(b=>{
        b.x+=b.vx;
        b.y+=b.vy;
        
        // Add bullet trail particles
        if(frameCount % 2 === 0) {
          particles.push({
            x: b.x,
            y: b.y + 5,
            size: Math.random() * 1.5 + 0.5,
            alpha: 0.7,
            color: '#f84'
          });
        }
      });
      
      // Update particles
      particles.forEach((p, i) => {
        p.alpha -= 0.02;
        if(p.alpha <= 0) particles.splice(i, 1);
      });
      
      // Update points text
      pointsText.forEach((pt,i)=>{pt.y-=0.5;pt.alpha-=0.02;if(pt.alpha<=0)pointsText.splice(i,1);});
      
      // Update enemies
      enemies.forEach(e=>{
        // Add engine particles
        if(frameCount % 4 === 0) {
          e.engineParticles.push({
            x: e.x + (Math.random() * e.size/2 - e.size/4),
            y: e.y + e.size/1.5,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 2 + 1,
            alpha: 0.7
          });
        }
        
        if(e.isShooter&&!e.stopped&&e.y>=e.stopY) e.stopped=true;
        if(!e.stopped) e.y+=e.speed;
        if(e.isShooter&&e.stopped&&--e.shootCooldown<=0){
          const dx=player.x-e.x,dy=player.y-e.y,len=Math.hypot(dx,dy);
          enemyBullets.push({x:e.x,y:e.y,vx:dx/len*4,vy:dy/len*4});
          e.shootCooldown=60;
        }
      });
      
      // Check bullet-enemy collisions
      for(let ei=enemies.length-1;ei>=0;ei--){
        const e=enemies[ei];
        for(let bi=player.bullets.length-1;bi>=0;bi--){
          const b=player.bullets[bi];
          if(Math.hypot(e.x-b.x,e.y-b.y)<e.size){
            // Create explosion
            explosions.push({
              x:e.x,
              y:e.y,
              frame:0
            });
          playSound(sounds.explosion);
            
            // Add explosion particles
            for(let i = 0; i < 15; i++) {
              particles.push({
                x: e.x,
                y: e.y,
                size: Math.random() * 3 + 1,
                alpha: 1,
                color: `hsl(${Math.random()*30 + 20}, 100%, 50%)`,
                vx: Math.random() * 4 - 2,
                vy: Math.random() * 4 - 2
              });
            }
            
            const pts=Math.round(e.speed/e.size*100);
            pointsText.push({x:e.x,y:e.y,text:pts,alpha:1});
            scoreboard.score+=pts;
            damageFreePoints+=pts;
            document.getElementById('score').textContent=scoreboard.score;
            if(scoreboard.score>scoreboard.highscore){
              scoreboard.highscore=scoreboard.score;
              localStorage.setItem('highscore',scoreboard.highscore);
              document.getElementById('highscore').textContent=scoreboard.highscore;
            }
            enemies.splice(ei,1);
            player.bullets.splice(bi,1);
            break;
          }
        }
      }
      
      // Spawn power-ups at score thresholds
      if(scoreboard.score>=nextScorePowerThreshold){
        if(Math.random()<0.5)spawnPowerUp();
        nextScorePowerThreshold+=500;
      }
      
      // Enemies leaving screen always deduct health (ignore invincibility)
      for(let i=enemies.length-1;i>=0;i--){
        if(enemies[i].y>canvas.height){
          scoreboard.health--;
          document.getElementById('health').textContent=scoreboard.health;
          triggerPlayerFlash();
          
          // Create splash effect
          explosions.push({
            x: enemies[i].x,
            y: canvas.height,
            frame: 0
          });          
          
          enemies.splice(i,1);
        }
      }
      
      // Enemy collisions - protected by invincibility
      for(let i=enemies.length-1;i>=0;i--){
        const e=enemies[i];
        if(Math.hypot(e.x-player.x,e.y-player.y)<e.size+player.size/2){
          if(!player.invincible){
            scoreboard.health--;
            document.getElementById('health').textContent=scoreboard.health;
            triggerPlayerFlash();
          }
          
          // Create explosion
          explosions.push({
            x: e.x,
            y: e.y,
            frame: 0
          });
          playSound(sounds.explosion);
          
          enemies.splice(i,1);
        }
      }
      
      // Enemy bullets - protected by invincibility
      for(let i=enemyBullets.length-1;i>=0;i--){
        const b=enemyBullets[i];
        if(Math.hypot(b.x-player.x,b.y-player.y)<player.size/2){
          if(!player.invincible){
            scoreboard.health--;
            document.getElementById('health').textContent=scoreboard.health;
            triggerPlayerFlash();
            
            // Create hit effect
            explosions.push({
              x: b.x,
              y: b.y,
              frame: 0
            });
          playSound(sounds.explosion);
          }
          enemyBullets.splice(i,1);
        }
      }
      
      // Check power-up collisions
      powerUps.forEach((p,i)=>{
        if(Math.hypot(p.x-player.x,p.y-player.y)<player.size/2+p.size){
          let duration=(2500*scoreboard.level + 1000*Math.floor(damageFreePoints/100));
          if(p.type==='health'){
            scoreboard.health++;
            document.getElementById('health').textContent=scoreboard.health;
          }
          if(p.type==='spread'){
            player.spread=true;
            activePowerUps.push({type:'spread',expire:now+duration});
          }
          if(p.type==='invincible'){
            player.invincible=true;
            activePowerUps.push({type:'invincible',expire:now+duration});
          }
          if(p.type==='infiniteRange'){
            player.infiniteRange=true;
            activePowerUps.push({type:'infiniteRange',expire:now+duration});
          }
          
          // Create collection effect
          for(let j = 0; j < 20; j++) {
            particles.push({
              x: p.x,
              y: p.y,
              size: Math.random() * 3 + 1,
              alpha: 1,
              color: p.color,
              vx: Math.random() * 4 - 2,
              vy: Math.random() * -4 - 2
            });
          }
          
          powerUps.splice(i,1);
          playSound(sounds.powerup);
          updatePowerupsDisplay(now);
        }
      });
      
      // Level up check
      if(scoreboard.score>=scoreboard.level*250){
        scoreboard.level++;
        scoreboard.health++;
        document.getElementById('level').textContent=scoreboard.level;
        document.getElementById('health').textContent=scoreboard.health;
        spawnPowerUp();
        levelup.style.display='block';
        setTimeout(()=>levelup.style.display='none',2000);
      }      
      
      // Game over check
      if(scoreboard.health<=0){
        gameOver=true;        
        clearInterval(enemyInterval);
        document.getElementById('finalscore').textContent=scoreboard.score;
        document.getElementById('finalhighscore').textContent=scoreboard.highscore;        
        sounds.bgMusic.pause();        
        gameover.style.display='block';
      }
    }
    
    function draw(){
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw starfield
      stars.forEach(star => {
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI*2);
        ctx.fill();
      });
      
      // Draw particles
      particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      
      // Draw game objects
      drawPlayer();
      
      // Draw bullets with glow
      player.bullets.forEach(b => {
        // Bullet glow
        ctx.save();
        const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 6);
        gradient.addColorStop(0, 'rgba(255, 255, 100, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 100, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, Math.PI*2);
        ctx.fill();
        
        // Bullet core
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });
      
      enemyBullets.forEach(b => {
        // Bullet glow
        ctx.save();
        const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 6);
        gradient.addColorStop(0, 'rgba(255, 100, 50, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 100, 50, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, Math.PI*2);
        ctx.fill();
        
        // Bullet core
        ctx.fillStyle = '#f84';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });
      
      drawEnemies();
      drawExplosions();
      drawPowerUps();
      
      // Draw points text
      pointsText.forEach(pt => {
        ctx.fillStyle = `rgba(255, 255, 255, ${pt.alpha})`;
        ctx.font = '16px Audiowide';
        ctx.textAlign = 'center';
        ctx.fillText(pt.text, pt.x, pt.y);
      });
    }
    
    function shoot(){
      const now = Date.now();
      if(now - player.lastShot < 100) return; // Cooldown
      player.lastShot = now;
      playSound(sounds.shoot);
      
      const vy=-10;
      if(player.spread) {
        // Triple shot
        player.bullets.push({
          x:player.x,
          y:player.y-player.size/2,
          startY:player.y-player.size/2,
          vx:-2,
          vy
        });
        player.bullets.push({
          x:player.x,
          y:player.y-player.size/2,
          startY:player.y-player.size/2,
          vx:0,
          vy
        });
        player.bullets.push({
          x:player.x,
          y:player.y-player.size/2,
          startY:player.y-player.size/2,
          vx:2,
          vy
        });
      } else {
        // Single shot
        player.bullets.push({
          x:player.x,
          y:player.y-player.size/2,
          startY:player.y-player.size/2,
          vx:0,
          vy
        });
      }
      
      // Muzzle flash
      for(let i = 0; i < 5; i++) {
        particles.push({
          x: player.x + (Math.random() * 10 - 5),
          y: player.y - player.size/2,
          size: Math.random() * 3 + 1,
          alpha: 1,
          color: '#ff0',
          vx: Math.random() * 4 - 2,
          vy: Math.random() * -2 - 2
        });
      }
    }
    
    function updatePlayer(){
      if (Math.hypot(joyX, joyY) > 0) {
          // move by joystick
          player.x += joyX * player.speed;
          player.y += joyY * player.speed;
      } else {
          // existing keyboard controls
          if (keys['ArrowUp'] || keys['w'])    player.y -= player.speed;
          if (keys['ArrowDown']|| keys['s'])    player.y += player.speed;
          if (keys['ArrowLeft']|| keys['a'])    player.x -= player.speed;
          if (keys['ArrowRight']||keys['d'])    player.x += player.speed;
      }
      // clamp to canvas
      player.x = Math.max(player.size/2, Math.min(canvas.width  - player.size/2, player.x));
      player.y = Math.max(player.size/2, Math.min(canvas.height - player.size/2, player.y));
      
      if(keys['ArrowUp']||keys['w']) player.y-=player.speed;
      if(keys['ArrowDown']||keys['s']) player.y+=player.speed;
      if(keys['ArrowLeft']||keys['a']) player.x-=player.speed;
      if(keys['ArrowRight']||keys['d']) player.x+=player.speed;
      
      // Keep player within bounds
      player.x = Math.max(player.size/2, Math.min(canvas.width - player.size/2, player.x));
      player.y = Math.max(player.size/2, Math.min(canvas.height - player.size/2, player.y));
    }
    
    function gameLoop(){
      if(!gameOver) {
        update();
        draw();
        requestAnimationFrame(gameLoop);
      }
    }
    
    // Event listeners
    document.addEventListener('keydown', e => {
      keys[e.key] = true;
      
      // Shooting
      if((e.key === ' ' || e.key === 'z') && !gameOver && gameStarted) {
        shoot();
      }
      
      // Start/restart game
      if(e.key === 'Enter') {
        if(!gameStarted) {
          startGame();
        } else if(gameOver) {
          resetGame();
        }
      }
    });
    
    document.addEventListener('keyup', e => {
      keys[e.key] = false;
    });
    
    // Show start screen
    startscreen.style.display = 'block';

// ——— Touch Controls for Mobile ———
const shootBtn = document.getElementById('shootButton');

// ——— Virtual Joystick Setup ———
const joystick    = document.getElementById('joystick');
const joystickThumb = document.getElementById('joystick-thumb');
let joystickId   = null;
let joyX = 0, joyY = 0;

function updateJoystick(touch) {
  const rect = joystick.getBoundingClientRect();
  const dx   = touch.clientX - (rect.left + rect.width/2);
  const dy   = touch.clientY - (rect.top  + rect.height/2);
  const max  = rect.width/2;
  const dist = Math.hypot(dx, dy);
  const angle= Math.atan2(dy, dx);
  const limited = Math.min(dist, max);
  // move thumb
  const tx = Math.cos(angle) * limited;
  const ty = Math.sin(angle) * limited;
  joystickThumb.style.transform = `translate(${tx}px, ${ty}px)`;
  // normalized direction vector
  joyX = tx / max;
  joyY = ty / max;
}

joystick.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joystickId = t.identifier;
  updateJoystick(t);
});

joystick.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joystickId) {
      updateJoystick(t);
      break;
    }
  }
});

joystick.addEventListener('touchend', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joystickId) {
      joystickId = null;
      joyX = joyY = 0;
      joystickThumb.style.transform = 'translate(-50%, -50%)';
      break;
    }
  }
});
// ——— End Joystick Setup ———

// Start game for mobiles
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!gameStarted) {
    startGame();
  } else if (gameOver) {
    resetGame();
  }
});

// Touch to shoot via button
shootBtn.addEventListener('touchstart', e => {
  e.preventDefault();
  shoot();
});
// ——— End Touch Controls ———
