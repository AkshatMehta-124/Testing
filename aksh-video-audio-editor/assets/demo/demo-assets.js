/**
 * AKSH Video & Audio Editor - Demo Assets
 * Self-contained SVG logo and procedural anime backdrop generator
 * Completely offline, zero network dependencies
 */

const DemoAssets = (() => {
  /**
   * Stylized Aksh Studio Anime Cyber Emblem (SVG Data URL)
   */
  const SVG_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00f3ff"/>
        <stop offset="50%" stop-color="#b026ff"/>
        <stop offset="100%" stop-color="#ff2a54"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff5c0"/>
        <stop offset="50%" stop-color="#ffb700"/>
        <stop offset="100%" stop-color="#ff5500"/>
      </linearGradient>
      <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Background shield shape -->
    <polygon points="250,30 430,110 430,340 250,470 70,340 70,110" 
             fill="rgba(11, 13, 19, 0.85)" stroke="url(#grad1)" stroke-width="6" filter="url(#neonGlow)" />
    <!-- Inner geometric cyber diamond -->
    <polygon points="250,80 390,250 250,420 110,250" 
             fill="none" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2" stroke-dasharray="8 6"/>
    <!-- Cyber Wing Blades Left -->
    <path d="M 110,230 L 30,190 L 80,270 Z" fill="url(#grad1)" opacity="0.85"/>
    <path d="M 90,280 L 20,290 L 70,340 Z" fill="url(#grad1)" opacity="0.6"/>
    <!-- Cyber Wing Blades Right -->
    <path d="M 390,230 L 470,190 L 420,270 Z" fill="url(#grad1)" opacity="0.85"/>
    <path d="M 410,280 L 480,290 L 430,340 Z" fill="url(#grad1)" opacity="0.6"/>
    <!-- Central Monogram A -->
    <path d="M 250,130 L 330,330 L 290,330 L 272,280 L 228,280 L 210,330 L 170,330 Z M 250,210 L 236,250 L 264,250 Z" 
          fill="url(#goldGrad)" filter="url(#neonGlow)"/>
    <!-- Cyber Cross Core -->
    <circle cx="250" cy="250" r="14" fill="#ffffff" filter="url(#neonGlow)"/>
    <!-- Corner Tech Accents -->
    <line x1="250" y1="40" x2="250" y2="70" stroke="#00f3ff" stroke-width="3"/>
    <line x1="250" y1="430" x2="250" y2="460" stroke="#ff2a54" stroke-width="3"/>
  </svg>`;

  const LOGO_DATA_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(SVG_LOGO);

  /**
   * Generates a high-resolution dark anime cyberpunk background canvas
   * @param {number} width 
   * @param {number} height 
   * @returns {HTMLCanvasElement}
   */
  function createDemoBackground(width = 1080, height = 1920) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Deep cosmic gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, width * 0.5, height);
    bgGrad.addColorStop(0, '#05070d');
    bgGrad.addColorStop(0.35, '#0e0b1f');
    bgGrad.addColorStop(0.7, '#1b092b');
    bgGrad.addColorStop(1, '#080511');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Distant Cyber City Skyline Silhouette at bottom
    ctx.fillStyle = '#06040b';
    const numBuildings = 28;
    const bWidth = width / numBuildings;
    for (let i = 0; i < numBuildings; i++) {
      const bHeight = 180 + Math.sin(i * 1.5) * 120 + (i % 3) * 60;
      const x = i * bWidth;
      const y = height - bHeight;
      ctx.fillRect(x, y, bWidth + 2, bHeight);

      // Lit windows
      ctx.fillStyle = 'rgba(0, 243, 255, 0.4)';
      for (let wy = y + 20; wy < height - 20; wy += 35) {
        if ((i + wy) % 5 === 0) {
          ctx.fillRect(x + 6, wy, bWidth * 0.35, 12);
        }
      }
      ctx.fillStyle = '#06040b';
    }

    // 3. Digital Grid Horizon Line
    const horizonY = height * 0.72;
    const gridGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    gridGrad.addColorStop(0, 'rgba(176, 38, 255, 0.5)');
    gridGrad.addColorStop(1, 'rgba(0, 243, 255, 0.05)');
    ctx.strokeStyle = gridGrad;
    ctx.lineWidth = 1.5;

    // Horizontal perspective grid lines
    for (let i = 0; i < 14; i++) {
      const py = horizonY + Math.pow(i / 14, 2) * (height - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    // Perspective lines converging at center horizon
    const cx = width / 2;
    for (let x = -width; x <= width * 2; x += 90) {
      ctx.beginPath();
      ctx.moveTo(cx, horizonY);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 4. Glowing Celestial Anime Moon / Core behind center
    const moonX = width * 0.5;
    const moonY = height * 0.42;
    const moonGrad = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 320);
    moonGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    moonGrad.addColorStop(0.2, 'rgba(176, 38, 255, 0.25)');
    moonGrad.addColorStop(0.5, 'rgba(255, 42, 84, 0.15)');
    moonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 320, 0, Math.PI * 2);
    ctx.fill();

    // 5. Starfield / Atmospheric Dust Points
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 180; i++) {
      const sx = (Math.sin(i * 99.7) * 0.5 + 0.5) * width;
      const sy = (Math.cos(i * 33.3) * 0.5 + 0.5) * (height * 0.7);
      const sRadius = 0.5 + (i % 3) * 0.7;
      const sAlpha = 0.2 + (i % 5) * 0.15;
      ctx.fillStyle = `rgba(255, 255, 255, ${sAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Deep Vignette
    const vigGrad = ctx.createRadialGradient(cx, height / 2, width * 0.3, cx, height / 2, height * 0.65);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.55)');
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    return canvas;
  }

  return {
    SVG_LOGO,
    LOGO_DATA_URL,
    createDemoBackground
  };
})();

if (typeof window !== 'undefined') {
  window.DemoAssets = DemoAssets;
}
