/* A small, stage-local WebGL particle engine. Contexts are allocated only near the viewport. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const stages = new Map();
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia && window.matchMedia("(max-width: 700px)").matches;
  const MAX_LIVE_CONTEXTS = 2;
  let paused = false;
  let observer = null;
  let serial = 0;

  const hex = value => {
    const v = value.replace("#", "");
    return [parseInt(v.slice(0,2),16)/255, parseInt(v.slice(2,4),16)/255, parseInt(v.slice(4,6),16)/255];
  };
  const lerp = (a,b,t) => a + (b-a)*t;
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));

  function makeBrainMask() {
    // Side-biased 3/4 brain silhouette: irregular frontal/parietal/occipital lobes,
    // cerebellum and brainstem. Fold strokes are sampled more densely than the body,
    // creating a cortex-like ridged surface rather than a smooth cartoon cloud.
    const width = 420, height = 300;
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const c = canvas.getContext("2d");
    c.lineCap = "round"; c.lineJoin = "round";
    c.fillStyle = "rgba(255,255,255,.10)";
    c.strokeStyle = "rgba(255,255,255,.98)";
    c.lineWidth = 2.9;
    c.beginPath();
    c.moveTo(55,196);
    c.bezierCurveTo(28,184,22,158,39,137);
    c.bezierCurveTo(24,118,28,94,50,80);
    c.bezierCurveTo(40,58,58,35,82,38);
    c.bezierCurveTo(93,14,122,15,141,32);
    c.bezierCurveTo(160,12,185,19,202,37);
    c.bezierCurveTo(221,24,246,30,260,48);
    c.bezierCurveTo(284,39,308,54,316,76);
    c.bezierCurveTo(340,77,359,97,353,120);
    c.bezierCurveTo(373,138,368,163,348,179);
    c.bezierCurveTo(341,202,317,216,294,205);
    c.bezierCurveTo(275,224,247,220,229,207);
    c.bezierCurveTo(207,226,183,220,164,207);
    c.bezierCurveTo(143,224,117,216,105,202);
    c.bezierCurveTo(86,214,64,209,55,196);
    c.closePath(); c.fill(); c.stroke();

    // Cerebellum: smaller, densely folded lobe at the posterior/inferior edge.
    c.beginPath();
    c.moveTo(270,183);
    c.bezierCurveTo(294,174,323,186,330,206);
    c.bezierCurveTo(339,225,323,246,300,250);
    c.bezierCurveTo(279,257,254,246,248,228);
    c.bezierCurveTo(243,210,251,192,270,183);
    c.closePath(); c.fill(); c.stroke();

    // Brainstem joins the lower centre; kept tapering rather than a straight stalk.
    c.beginPath();
    c.moveTo(208,194);
    c.bezierCurveTo(205,213,211,232,220,247);
    c.bezierCurveTo(225,257,221,276,231,286);
    c.bezierCurveTo(237,292,248,287,247,278);
    c.bezierCurveTo(246,260,239,245,243,229);
    c.bezierCurveTo(247,214,242,200,235,193);
    c.closePath(); c.fill(); c.stroke();

    // Central sulcus and longer fissures separate the major cortical regions.
    c.lineWidth = 4.8;
    const folds = [
      [[79,48],[62,57],[67,73],[88,75]], [[102,34],[90,49],[101,64],[122,62]],
      [[130,42],[114,55],[122,75],[141,68]], [[157,31],[176,43],[167,59],[151,65]],
      [[184,38],[203,48],[195,66],[178,67]], [[219,43],[239,51],[232,69],[214,76]],
      [[246,57],[266,58],[274,77],[253,87]], [[284,72],[300,83],[290,101],[275,105]],
      [[319,99],[302,104],[306,122],[327,133]], [[337,137],[319,143],[318,161],[336,169]],
      [[52,97],[67,88],[83,99],[77,116]], [[42,128],[62,116],[78,130],[70,147]],
      [[83,82],[96,70],[115,83],[111,101]], [[105,94],[91,108],[106,124],[126,115]],
      [[134,78],[150,68],[163,83],[150,98]], [[161,90],[147,104],[164,118],[185,108]],
      [[194,78],[211,70],[225,87],[211,103]], [[230,91],[218,107],[231,122],[249,113]],
      [[271,99],[253,111],[265,128],[284,122]], [[302,125],[285,128],[283,145],[301,154]],
      [[59,155],[76,143],[91,157],[84,174]], [[91,135],[108,125],[122,140],[113,158]],
      [[128,124],[143,112],[160,128],[151,145]], [[161,143],[148,156],[163,172],[183,161]],
      [[196,126],[210,113],[225,130],[217,148]], [[233,142],[218,154],[231,171],[249,159]],
      [[267,143],[252,154],[262,171],[281,166]], [[301,169],[282,176],[281,191],[297,197]],
      [[113,174],[127,162],[142,177],[135,194]], [[151,187],[165,173],[181,187],[176,201]],
      [[188,167],[203,156],[216,172],[209,189]], [[225,184],[210,195],[224,210],[240,203]],
      [[72,180],[87,173],[100,187],[94,199]], [[266,201],[280,194],[296,209],[289,225]],
      [[285,218],[301,212],[314,226],[301,239]], [[260,222],[273,213],[287,226],[278,240]],
      [[272,234],[285,230],[296,240]], [[291,200],[307,196],[320,207]],
      [[198,44],[188,56],[193,68],[207,74]], [[146,51],[139,66],[149,79],[144,91]],
    ];
    folds.forEach(points => {
      c.beginPath(); c.moveTo(points[0][0], points[0][1]);
      if (points.length === 4) c.bezierCurveTo(points[1][0],points[1][1],points[2][0],points[2][1],points[3][0],points[3][1]);
      else points.slice(1).forEach(point => c.lineTo(point[0],point[1]));
      c.stroke();
    });
    // Interhemispheric groove, visible in the 3/4 angle but not a straight dividing line.
    c.lineWidth = 4.2;
    c.beginPath(); c.moveTo(202,38); c.bezierCurveTo(191,58,204,77,194,95);
    c.bezierCurveTo(184,116,201,131,195,150); c.bezierCurveTo(190,165,202,180,207,192); c.stroke();
    // Fine secondary sulci add detail without a separate post-processing pass.
    const fineFolds = [
      [65,72,80,88,95,87], [111,57,120,64,127,82], [177,50,185,60,178,75],
      [250,75,260,84,251,98], [308,91,315,102,307,111], [90,114,101,121,98,131],
      [143,103,151,113,145,122], [181,117,190,125,182,135], [243,119,251,130,244,139],
      [74,162,86,167,83,178], [118,151,128,158,123,169], [172,151,181,161,177,173],
      [210,153,219,162,215,174], [254,175,263,183,259,194], [282,193,292,201,287,211],
      [263,207,270,217,266,227], [303,229,312,233,304,241], [284,228,290,233,286,240]
    ];
    c.lineWidth = 1.8;
    fineFolds.forEach(([x1,y1,cx,cy,x2,y2]) => { c.beginPath(); c.moveTo(x1,y1); c.quadraticCurveTo(cx,cy,x2,y2); c.stroke(); });
    // Cut a narrow dark centre from each thick fold, leaving two luminous particle
    // banks on either side. This creates visible gyri/sulci instead of a flat cloud.
    c.globalCompositeOperation = "destination-out";
    c.strokeStyle = "rgba(0,0,0,1)";
    c.lineWidth = 2.2;
    folds.forEach(points => {
      c.beginPath(); c.moveTo(points[0][0], points[0][1]);
      if (points.length === 4) c.bezierCurveTo(points[1][0],points[1][1],points[2][0],points[2][1],points[3][0],points[3][1]);
      else points.slice(1).forEach(point => c.lineTo(point[0],point[1]));
      c.stroke();
    });
    c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(202,38); c.bezierCurveTo(191,58,204,77,194,95);
    c.bezierCurveTo(184,116,201,131,195,150); c.bezierCurveTo(190,165,202,180,207,192); c.stroke();
    c.globalCompositeOperation = "source-over";
    return { canvas, width, height };
  }
  function makeRobotMask() {
    const width = 256, height = 256;
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const c = canvas.getContext("2d");
    c.fillStyle = "rgba(255,255,255,1)"; c.strokeStyle = "rgba(255,255,255,1)";
    c.lineWidth = 15; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath(); c.moveTo(128,42); c.lineTo(128,61); c.stroke();
    c.beginPath(); c.arc(128,31,9,0,Math.PI*2); c.fill();
    c.beginPath(); c.roundRect(64,61,128,102,22); c.fill();
    c.beginPath(); c.roundRect(88,161,80,46,12); c.fill();
    c.beginPath(); c.moveTo(64,99); c.lineTo(43,99); c.lineTo(43,139); c.lineTo(64,139); c.stroke();
    c.beginPath(); c.moveTo(192,99); c.lineTo(213,99); c.lineTo(213,139); c.lineTo(192,139); c.stroke();
    c.beginPath(); c.moveTo(107,207); c.lineTo(107,226); c.moveTo(149,207); c.lineTo(149,226); c.stroke();
    c.globalCompositeOperation = "destination-out";
    c.beginPath(); c.arc(98,101,9,0,Math.PI*2); c.arc(158,101,9,0,Math.PI*2); c.fill();
    c.beginPath(); c.roundRect(103,124,50,7,3); c.fill();
    c.globalCompositeOperation = "source-over";
    // A narrow highlight frame is part of the sampled silhouette, not a bitmap asset.
    c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 2;
    c.beginPath(); c.roundRect(75,72,106,82,15); c.stroke();
    return { canvas, width, height };
  }
  const masks = { brain: null, robot: null };
  function pointsFor(scene) {
    const mask = masks[scene] || (masks[scene] = scene === "robot" ? makeRobotMask() : makeBrainMask());
    const ctx = mask.canvas.getContext("2d");
    const data = ctx.getImageData(0,0,mask.width,mask.height).data;
    const pool = [];
    for (let y = 0; y < mask.height; y += 1) {
      for (let x = 0; x < mask.width; x += 1) {
        const alpha = data[(y * mask.width + x) * 4 + 3];
        if (alpha > 22 && Math.random() * 255 < alpha) pool.push([x,y,alpha]);
      }
    }
    const count = scene === "robot" ? (mobile ? 900 : 1400) : (mobile ? 2500 : 5800);
    const targets = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const shapes = new Float32Array(count);
    const purple = hex("#315E91"), yellow = hex("#F2CC4D"), green = hex("#5AB7BD");
    // Brain uses exactly three tones that differ only in lightness (no x-axis gradient).
    const TONE_SHADE = hex("#5C88BA"), TONE_MID = hex("#A3C3E3"), TONE_LIGHT = hex("#F4F9FF");
    // Local relief shading for the brain: blur the mask into a height field, then light it
    // from the upper left. Sunward slopes get the light tone, shadowed slopes the dark tone,
    // so folds and gyri read as texture instead of a global colour sweep.
    let shadeAt = null, cutLow = 0, cutHigh = 0;
    if (scene !== "robot") {
      const W = mask.width, H = mask.height, R = 3;
      const src = new Float32Array(W*H), tmp = new Float32Array(W*H), hgt = new Float32Array(W*H);
      for (let k=0;k<W*H;k++) src[k] = data[k*4+3] / 255;
      for (let y=0;y<H;y++) for (let x=0;x<W;x++) { let a=0,n=0; for (let d=-R;d<=R;d++){ const xx=x+d; if (xx>=0&&xx<W){a+=src[y*W+xx];n++;} } tmp[y*W+x]=a/n; }
      for (let y=0;y<H;y++) for (let x=0;x<W;x++) { let a=0,n=0; for (let d=-R;d<=R;d++){ const yy=y+d; if (yy>=0&&yy<H){a+=tmp[yy*W+x];n++;} } hgt[y*W+x]=a/n; }
      const LX = -0.62, LY = -0.78; // light direction in image space (towards upper left)
      shadeAt = (px, py) => {
        const x = clamp(Math.round(px),1,W-2), y = clamp(Math.round(py),1,H-2);
        const gx = hgt[y*W+x+1]-hgt[y*W+x-1], gy = hgt[(y+1)*W+x]-hgt[(y-1)*W+x];
        return -(gx*LX + gy*LY);
      };
      const vals = [];
      for (let q=0;q<pool.length;q+=3) vals.push(shadeAt(pool[q][0],pool[q][1]));
      vals.sort((a,b)=>a-b);
      cutLow = vals[Math.floor(vals.length*.30)] || 0;
      cutHigh = vals[Math.floor(vals.length*.72)] || 0;
    }
    for (let i=0; i<count; i++) {
      let sample;
      if (pool.length) sample = pool[Math.floor(Math.random() * pool.length)];
      else sample = [Math.random()*mask.width, Math.random()*mask.height, 255];
      let x = (sample[0] / mask.width - .5) * (scene === "robot" ? 1.42 : 1.92);
      let y = (.5 - sample[1] / mask.height) * (scene === "robot" ? 1.42 : 1.48);
      // The cortex is a 3D shell, not a flat silhouette. Depth tapers at the outer
      // boundary and sulcus strokes sit slightly forward to form a ridged surface.
      let z;
      if (scene === "robot") z = (Math.random() - .5) * .24;
      else {
        const nx = sample[0] / mask.width * 2 - 1;
        const ny = 1 - sample[1] / mask.height * 2;
        const depthEnvelope = Math.sqrt(Math.max(.06, 1 - nx * nx * .72 - ny * ny * .8));
        z = (Math.random() - .5) * .86 * depthEnvelope + (sample[2] > 190 ? .095 : -.018);
      }
      targets[i*3] = x; targets[i*3+1] = y; targets[i*3+2] = z;
      let color;
      if (scene === "robot") {
        const eye = Math.abs(sample[0]-98)<7 && Math.abs(sample[1]-101)<7 || Math.abs(sample[0]-158)<7 && Math.abs(sample[1]-101)<7;
        if (eye || sample[1] < 42) color = yellow;
        else if (sample[0] < 78 || sample[0] > 178) color = green;
        else color = purple;
      } else {
        // Three fixed tones by local relief; ridge crests that also face the light get the brightest tone.
        const relief = shadeAt(sample[0], sample[1]);
        if (relief >= cutHigh) color = TONE_LIGHT;
        else if (relief <= cutLow) color = TONE_SHADE;
        else color = TONE_MID;
      }
      colors.set(color, i*3);
      sizes[i] = scene === "robot" ? 1.05 + Math.random()*.78 : 1.5 + Math.random()*.88 + (sample[2] > 190 ? .22 : 0);
      const shapeRoll = Math.random();
      shapes[i] = shapeRoll < .68 ? 1 : (shapeRoll < .88 ? 2 : 3);
    }
    if (scene === "robot") {
      // A few deliberately bright particles preserve a readable, softly glowing gaze.
      [[98,101],[158,101]].forEach((eye,index) => {
        for (let j=0;j<7;j++) {
          const k = index*7+j;
          targets[k*3] = (eye[0] / mask.width - .5) * 1.42 + (Math.random()-.5)*.035;
          targets[k*3+1] = (.5-eye[1]/mask.height)*1.42 + (Math.random()-.5)*.035;
          targets[k*3+2] = .22;
          colors.set(yellow,k*3); sizes[k] = 1.55 + Math.random()*.6;
        }
      });
    }
    return { targets, colors, sizes, shapes, count };
  }

  function shaderSource(is2, fragment) {
    if (!fragment) {
      return is2 ? `#version 300 es
in vec3 aPos; in vec3 aCol; in float aSize; in float aShape;
uniform float uRotY,uRotX,uScale,uDpr,uTime,uAlpha; out vec3 vCol; out float vTw; out float vShape;
void main(){ vec3 p=aPos; float cx=cos(uRotX),sx=sin(uRotX); p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx); float cy=cos(uRotY),sy=sin(uRotY); p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy); float depth=3.5-p.z; float scale=uScale/depth; gl_Position=vec4(p.x*scale,p.y*scale,0.0,1.0); vTw=0.72+0.28*sin(uTime*1.4+aPos.x*13.0+aPos.y*17.0+aPos.z*19.0); vCol=aCol; vShape=aShape; gl_PointSize=clamp(aSize*uDpr*scale*7.6,3.0,22.0*uDpr); }`
      : `attribute vec3 aPos; attribute vec3 aCol; attribute float aSize; attribute float aShape;
uniform float uRotY,uRotX,uScale,uDpr,uTime,uAlpha; varying vec3 vCol; varying float vTw; varying float vShape;
void main(){ vec3 p=aPos; float cx=cos(uRotX),sx=sin(uRotX); p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx); float cy=cos(uRotY),sy=sin(uRotY); p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy); float depth=3.5-p.z; float scale=uScale/depth; gl_Position=vec4(p.x*scale,p.y*scale,0.0,1.0); vTw=0.72+0.28*sin(uTime*1.4+aPos.x*13.0+aPos.y*17.0+aPos.z*19.0); vCol=aCol; vShape=aShape; gl_PointSize=clamp(aSize*uDpr*scale*7.6,3.0,22.0*uDpr); }`;
    }
    return is2 ? `#version 300 es
precision mediump float; in vec3 vCol; in float vTw; in float vShape; uniform float uAlpha; out vec4 outColor;
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a; vec2 ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
void main(){ vec2 p=gl_PointCoord-vec2(.5); float d;
if(vShape<1.5){ d=min(seg(p,vec2(0.0,-.43),vec2(-.39,.29)),min(seg(p,vec2(-.39,.29),vec2(.39,.29)),seg(p,vec2(.39,.29),vec2(0.0,-.43)))); }
else if(vShape<2.5){ d=min(seg(p,vec2(0.0,-.44),vec2(.44,0.0)),min(seg(p,vec2(.44,0.0),vec2(0.0,.44)),min(seg(p,vec2(0.0,.44),vec2(-.44,0.0)),seg(p,vec2(-.44,0.0),vec2(0.0,-.44)))); }
else { d=min(seg(p,vec2(-.34,-.34),vec2(.34,-.34)),min(seg(p,vec2(.34,-.34),vec2(.34,.34)),min(seg(p,vec2(.34,.34),vec2(-.34,.34)),seg(p,vec2(-.34,.34),vec2(-.34,-.34)))); }
float core=1.0-smoothstep(.018,.065,d); float glow=1.0-smoothstep(.055,.33,d); float a=max(core,glow*.18); outColor=vec4(vCol,a*vTw*uAlpha); }`
      : `precision mediump float; varying vec3 vCol; varying float vTw; varying float vShape; uniform float uAlpha;
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a; vec2 ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }
void main(){ vec2 p=gl_PointCoord-vec2(.5); float d;
if(vShape<1.5){ d=min(seg(p,vec2(0.0,-.43),vec2(-.39,.29)),min(seg(p,vec2(-.39,.29),vec2(.39,.29)),seg(p,vec2(.39,.29),vec2(0.0,-.43)))); }
else if(vShape<2.5){ d=min(seg(p,vec2(0.0,-.44),vec2(.44,0.0)),min(seg(p,vec2(.44,0.0),vec2(0.0,.44)),min(seg(p,vec2(0.0,.44),vec2(-.44,0.0)),seg(p,vec2(-.44,0.0),vec2(0.0,-.44)))); }
else { d=min(seg(p,vec2(-.34,-.34),vec2(.34,-.34)),min(seg(p,vec2(.34,-.34),vec2(.34,.34)),min(seg(p,vec2(.34,.34),vec2(-.34,.34)),seg(p,vec2(-.34,.34),vec2(-.34,-.34)))); }
float core=1.0-smoothstep(.018,.065,d); float glow=1.0-smoothstep(.055,.33,d); float a=max(core,glow*.18); gl_FragColor=vec4(vCol,a*vTw*uAlpha); }`;
  }
  function createProgram(gl, is2) {
    function compile(type, src) {
      const shader = gl.createShader(type); gl.shaderSource(shader, src); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) { const log=gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(log || "Shader compile failed"); }
      return shader;
    }
    const program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER,shaderSource(is2,false));
    const fs = compile(gl.FRAGMENT_SHADER,shaderSource(is2,true));
    gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) { const log=gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(log || "Program link failed"); }
    return program;
  }
  function setupAttrib(gl, buffer, location, size) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);
  }
  function makeDataSeaRenderer(stage) {
    const canvas = stage.canvas;
    let ctx;
    try { ctx = canvas.getContext("2d", { alpha: true, desynchronized: true }); } catch (_) { ctx = null; }
    if (!ctx) return null;
    const reduced = reducedMotion;
    const ROWS = mobile ? 24 : 34;
    const COLS = mobile ? 64 : 100;
    const DURATION = 10000;
    const labelPairs = [
      ["ATTN  73.6%", "注意  73.6%"], ["PRED  0.982", "预测  0.982"],
      ["SIGNAL +0.672", "信号 +0.672"], ["CONF  98.2", "置信  98.2"],
      ["FREQ  42.8Hz", "频率  42.8Hz"], ["ΔT  04.18ms", "时差  04.18ms"],
      ["NODE  1A07", "节点  1A07"], ["SYNC  96.4%", "同步  96.4%"],
      ["ENTROPY 0.184", "熵值  0.184"], ["MODEL  R-07", "模型  R-07"],
      ["TRACE  8C.21", "轨迹  8C.21"], ["DECAY  0.008", "衰减  0.008"]
    ];
    const packets = labelPairs.map((pair, i) => ({
      label: pair[Aloop.i18n?.lang === "zh" ? 1 : 0], pair,
      phase: i / labelPairs.length,
      // Fixed lane offset keeps text distributed across the whole ocean while each
      // label still moves right and fades on its own 10-second cycle.
      startX: ((i * 0.61803398875) % 1) * 1.12 - .12,
      row: 2 + ((i * 7 + 3) % Math.max(4, ROWS - 5)),
      drift: 0.72 + (i % 4) * 0.09,
      flicker: 0.45 + (i % 5) * 0.13
    }));
    let width = 0, height = 0, dpr = 1, timer = 0, raf = 0, startedAt = performance.now();
    const WAVE_SPEED = 0.8;             // 20% slower than the previous wave motion
    const TEXT_TRAVEL = 0.57;           // 20% slower than the wave horizontal phase speed
    const colCount = COLS + 1;
    function syncLabels() {
      const index = Aloop.i18n?.lang === "zh" ? 1 : 0;
      packets.forEach(packet => { packet.label = packet.pair[index]; });
    }
    document.addEventListener("aloop:language", syncLabels);
    const coords = new Float32Array(ROWS * colCount * 2);
    let isRunning = false;
    const clamp01 = value => Math.max(0, Math.min(1, value));

    function resize() {
      const rect = stage.el.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.15 : 1.35);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function surfaceY(xNorm, row, time) {
      const depth = row / Math.max(1, ROWS - 1);
      const base = height * (0.27 + depth * 0.56);
      const amp = height * (0.018 + depth * 0.055);
      const x = Math.max(-0.12, Math.min(1.12, xNorm));
      const waveTime = time * WAVE_SPEED;
      return base
        + Math.sin(x * 6.5 - waveTime * 0.00058 + depth * 4.4) * amp
        + Math.sin(x * 14.1 + waveTime * 0.00024 + depth * 2.1) * amp * 0.22;
    }
    function drawGrid(time) {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col <= COLS; col++) {
          const i = (row * colCount + col) * 2;
          const xNorm = col / COLS;
          coords[i] = xNorm * width;
          coords[i + 1] = surfaceY(xNorm, row, time);
        }
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = 0;
      for (let row = 0; row < ROWS; row++) {
        const depth = row / Math.max(1, ROWS - 1);
        ctx.beginPath();
        for (let col = 0; col <= COLS; col++) {
          const i = (row * colCount + col) * 2;
          if (col === 0) ctx.moveTo(coords[i], coords[i + 1]);
          else ctx.lineTo(coords[i], coords[i + 1]);
        }
        ctx.strokeStyle = `rgba(242,204,77,${0.095 + depth * 0.17})`;
        ctx.lineWidth = 0.55 + depth * 0.28;
        ctx.stroke();
      }
      for (let col = 0; col <= COLS; col += 2) {
        ctx.beginPath();
        for (let row = 0; row < ROWS; row++) {
          const i = (row * colCount + col) * 2;
          if (row === 0) ctx.moveTo(coords[i], coords[i + 1]);
          else ctx.lineTo(coords[i], coords[i + 1]);
        }
        const major = col % 10 === 0;
        ctx.strokeStyle = major ? "rgba(242,204,77,.16)" : "rgba(242,204,77,.075)";
        ctx.lineWidth = major ? 0.72 : 0.42;
        ctx.stroke();
      }
      // A few luminous crest-lines bring a liquid, data-topography quality without heavy post-processing.
      ctx.shadowColor = "rgba(242,204,77,.8)";
      ctx.shadowBlur = 10;
      for (let row = 3; row < ROWS; row += 5) {
        ctx.beginPath();
        for (let col = 0; col <= COLS; col++) {
          const i = (row * colCount + col) * 2;
          if (col === 0) ctx.moveTo(coords[i], coords[i + 1]);
          else ctx.lineTo(coords[i], coords[i + 1]);
        }
        ctx.strokeStyle = "rgba(242,204,77,.34)";
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // Geometric point accents are drawn sparsely, keeping cost predictable on mobile.
      for (let row = 0; row < ROWS; row += 2) {
        const depth = row / Math.max(1, ROWS - 1);
        for (let col = (row % 4 === 0 ? 0 : 2); col <= COLS; col += 4) {
          const i = (row * colCount + col) * 2;
          const x = coords[i], y = coords[i + 1];
          const r = 0.95 + depth * 1.1;
          ctx.beginPath();
          ctx.moveTo(x, y - r * 1.65); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.65); ctx.lineTo(x - r, y); ctx.closePath();
          ctx.fillStyle = (col + row) % 11 === 0 ? "rgba(255,255,255,.88)" : `rgba(255,204,63,${0.32 + depth * 0.52})`;
          ctx.fill();
        }
      }
    }
    function drawPacket(packet, progress, time) {
      const x = packet.startX * width + progress * width * TEXT_TRAVEL;
      if (x < -130 || x > width + 130) return;
      const xNorm = x / Math.max(1, width);
      const surface = surfaceY(xNorm, packet.row, time);
      const y = surface - 9 - Math.sin(time * 0.00088 + packet.row) * 3.0;
      const fadeIn = clamp01(progress / 0.055);
      const fadeOut = clamp01((1 - progress) / 0.105);
      const alpha = Math.min(fadeIn, fadeOut) * (0.78 + 0.22 * Math.sin(time * 0.003 * packet.flicker + packet.row));
      if (alpha <= 0.01) return;
      const rayHeight = 44 + (packet.row % 4) * 17;
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = "lighter";
      const ray = ctx.createLinearGradient(x, y - rayHeight, x, y + 2);
      ray.addColorStop(0, "rgba(255,255,255,0)");
      ray.addColorStop(0.34, "rgba(255,255,255,.12)");
      ray.addColorStop(0.74, "rgba(255,255,255,.48)");
      ray.addColorStop(1, "rgba(255,255,255,.86)");
      ctx.strokeStyle = ray;
      ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.moveTo(x, y - rayHeight); ctx.lineTo(x, y + 1); ctx.stroke();
      for (let rayIndex = -2; rayIndex <= 2; rayIndex++) {
        if (rayIndex === 0 || (packet.row + rayIndex) % 2 === 0) {
          const rayX = x + rayIndex * 3.4;
          ctx.strokeStyle = `rgba(255,255,255,${0.08 + (2 - Math.abs(rayIndex)) * 0.045})`;
          ctx.lineWidth = 0.45;
          ctx.beginPath(); ctx.moveTo(rayX, y - rayHeight * (0.35 + ((packet.row + rayIndex + 8) % 4) * 0.12)); ctx.lineTo(rayX, y - 1); ctx.stroke();
        }
      }
      const glow = ctx.createRadialGradient(x, y - 7, 0, x, y - rayHeight * .48, rayHeight * .72);
      glow.addColorStop(0, "rgba(255,255,255,.22)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - rayHeight * .65, y - rayHeight * 1.15, rayHeight * 1.3, rayHeight * 1.2);
      ctx.shadowColor = "rgba(255,255,255,1)";
      ctx.shadowBlur = 23;
      ctx.fillStyle = "rgba(255,255,255,.76)";
      ctx.font = `600 ${Math.max(9, Math.min(13, width / 92))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(packet.label, x, y - 6);
      ctx.shadowBlur = 7;
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fillText(packet.label, x, y - 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,198,54,.9)";
      ctx.fillRect(x - 21, y + 3, 42, 1);
      // A few fixed twinkles rise along the same ray template; no per-particle state is stored.
      for (let k = 0; k < 3; k++) {
        const q = (time * 0.00017 * packet.drift + packet.phase + k * 0.31) % 1;
        const py = y - 5 - q * rayHeight;
        const px = x + Math.sin(packet.phase * 19 + k * 4.8) * (2 + k * 2.1);
        const r = k === 0 ? 1.2 : 0.65;
        ctx.fillStyle = k === 0 ? "rgba(255,255,255,.8)" : "rgba(255,204,72,.75)";
        ctx.fillRect(px - r / 2, py - r / 2, r, r);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }
    function draw(time) {
      if (!width || !height) resize();
      const t = reduced ? 0 : time - startedAt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawGrid(t);
      packets.forEach(packet => {
        const progress = reduced ? packet.phase : ((t / DURATION + packet.phase) % 1);
        drawPacket(packet, progress, t);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      stage.el.classList.add("is-ready");
    }
    function loop() {
      if (!isRunning || document.hidden || !stage.near) return;
      timer = window.setTimeout(() => {
        timer = 0;
        if (!isRunning || document.hidden || !stage.near) return;
        raf = window.requestAnimationFrame(time => {
          raf = 0;
          draw(time);
          loop();
        });
      }, 33);
    }
    function start() {
      if (isRunning || document.hidden || !stage.near) return;
      isRunning = true;
      resize();
      if (reduced) draw(performance.now());
      else loop();
    }
    function stop() {
      isRunning = false;
      if (timer) window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
      timer = 0; raf = 0;
    }
    function onResize() { resize(); if (isRunning) draw(performance.now()); }
    window.addEventListener("resize", onResize, { passive: true });
    const renderer = {
      start, stop, resize: onResize,
      dispose() {
        stop(); window.removeEventListener("resize", onResize);
        document.removeEventListener("aloop:language", syncLabels);
        ctx.clearRect(0, 0, width, height);
        stage.el.classList.remove("is-ready");
      }
    };
    stage.renderer = renderer;
    renderer.start();
    return renderer;
  }

  function makeRenderer(stage) {
    if (stage.scene === "data-sea") return makeDataSeaRenderer(stage);
    const canvas = stage.canvas;
    let gl = null, is2 = false;
    const options = { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false };
    try {
      gl = canvas.getContext("webgl2",options);
      if (gl) is2 = true;
      else gl = canvas.getContext("webgl",options) || canvas.getContext("experimental-webgl",options);
    } catch (_) { gl = null; }
    if (!gl) return null;
    try {
      const scene = pointsFor(stage.scene);
      const program = createProgram(gl,is2);
      const pos = new Float32Array(scene.targets);
      const initial = performance.now();
      const scatter = stage.scene === "robot" ? 1.7 : .5;
      for (let i=0;i<scene.count*3;i++) pos[i] += (Math.random()-.5)*scatter;
      const posBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer); gl.bufferData(gl.ARRAY_BUFFER,pos,gl.DYNAMIC_DRAW);
      const colorBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer); gl.bufferData(gl.ARRAY_BUFFER,scene.colors,gl.STATIC_DRAW);
      const sizeBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,sizeBuffer); gl.bufferData(gl.ARRAY_BUFFER,scene.sizes,gl.STATIC_DRAW);
      const shapeBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,shapeBuffer); gl.bufferData(gl.ARRAY_BUFFER,scene.shapes,gl.STATIC_DRAW);
      const attribs = { aPos: gl.getAttribLocation(program,"aPos"), aCol: gl.getAttribLocation(program,"aCol"), aSize: gl.getAttribLocation(program,"aSize"), aShape: gl.getAttribLocation(program,"aShape") };
      const uniforms = { rotY: gl.getUniformLocation(program,"uRotY"), rotX: gl.getUniformLocation(program,"uRotX"), scale: gl.getUniformLocation(program,"uScale"), dpr: gl.getUniformLocation(program,"uDpr"), time: gl.getUniformLocation(program,"uTime"), alpha: gl.getUniformLocation(program,"uAlpha") };
      const vaoExt = is2 ? null : gl.getExtension("OES_vertex_array_object");
      const vao = is2 ? gl.createVertexArray() : (vaoExt ? vaoExt.createVertexArrayOES() : null);
      const bindVao = () => { if (is2) gl.bindVertexArray(vao); else if (vaoExt) vaoExt.bindVertexArrayOES(vao); };
      if (vao) {
        bindVao();
        setupAttrib(gl,posBuffer,attribs.aPos,3); setupAttrib(gl,colorBuffer,attribs.aCol,3); setupAttrib(gl,sizeBuffer,attribs.aSize,1); setupAttrib(gl,shapeBuffer,attribs.aShape,1);
        bindVao();
      }
      let dprCap = mobile ? 1.25 : 1.5;
      let activeCount = scene.count, qualityTier = 0, frameSamples = 0, frameSum = 0;
      let dpr = 1, width = 0, height = 0, raf = 0, idleTimer = 0, last = initial, moved = true;
      const pointer = { active: false, x: 0, y: 0, lastX: 0, lastY: 0, lastAt: 0, speed: 0 };
      const disp = new Float32Array(scene.count*3), vel = new Float32Array(scene.count*3);
      let shockAt = -Infinity, shockX = 0, shockY = 0, assembled = false;
      const duration = stage.scene === "robot" ? 1200 : 650;
      const scale = stage.scene === "robot" ? 2.78 : 3.12;
      function resize() {
        const rect = stage.el.getBoundingClientRect();
        width = Math.max(1,Math.round(rect.width)); height = Math.max(1,Math.round(rect.height));
        dpr = Math.min(window.devicePixelRatio || 1,dprCap);
        canvas.width = Math.max(1,Math.round(width*dpr)); canvas.height = Math.max(1,Math.round(height*dpr));
        gl.viewport(0,0,canvas.width,canvas.height); moved = true;
      }
      function updatePointer(event) {
        const rect = stage.el.getBoundingClientRect();
        pointer.x = clamp(((event.clientX-rect.left)/Math.max(1,rect.width))*2-1,-1,1);
        pointer.y = clamp(1-((event.clientY-rect.top)/Math.max(1,rect.height))*2,-1,1);
        pointer.active = true;
        const now = performance.now();
        const dt = Math.max(8,now-pointer.lastAt);
        pointer.speed = clamp(Math.hypot(event.clientX-pointer.lastX,event.clientY-pointer.lastY)/dt,0,1);
        pointer.lastX = event.clientX; pointer.lastY = event.clientY; pointer.lastAt = now;
        const angle = reducedMotion ? 0 : Math.sin(now*.00016)*.5;
        // Inverse of the scene's small Y rotation; scale from clip space back to model coordinates.
        const factor = scale/3.5;
        const x = pointer.x/factor, y = pointer.y/factor;
        pointer.localX = x*Math.cos(angle); pointer.localY = y;
        if (stage.scene === "brain" && Aloop.audio) Aloop.audio.glassGlide((event.clientY-rect.top)/Math.max(1,rect.height),pointer.speed);
      }
      function pointerLeave() { pointer.active = false; pointer.speed = 0; if (Aloop.audio) Aloop.audio.stopGlassGlide(); }
      function shockwave(event) {
        const rect = stage.el.getBoundingClientRect();
        shockX = clamp(((event.clientX-rect.left)/Math.max(1,rect.width))*2-1,-1,1);
        shockY = clamp(1-((event.clientY-rect.top)/Math.max(1,rect.height))*2,-1,1);
        shockAt = performance.now();
        stage.el.style.setProperty("--shock-x", `${(shockX+1)*50}%`);
        stage.el.style.setProperty("--shock-y", `${(1-shockY)*50}%`);
        stage.el.classList.remove("has-shockwave"); void stage.el.offsetWidth; stage.el.classList.add("has-shockwave");
        window.setTimeout(() => stage.el.classList.remove("has-shockwave"),700);
        if (stage.scene === "brain" && Aloop.audio) Aloop.audio.tink();
        const lx = shockX/(scale/3.5), ly = shockY/(scale/3.5);
        for (let i=0;i<scene.count;i++) {
          const j=i*3, dx=scene.targets[j]-lx, dy=scene.targets[j+1]-ly, dist=Math.hypot(dx,dy);
          if (dist < .6 && dist > .001) { const force=(1-dist/.6)*.48; vel[j] += dx/dist*force; vel[j+1] += dy/dist*force; }
        }
        moved = true;
      }
      function kinetic() {
        if (!assembled) return true;
        if (pointer.active) return true;
        let energy=0;
        for (let i=0;i<vel.length;i+=3) energy += Math.abs(vel[i])+Math.abs(vel[i+1])+Math.abs(vel[i+2])+Math.abs(disp[i])+Math.abs(disp[i+1])+Math.abs(disp[i+2]);
        return energy > .0002 || performance.now()-shockAt < 500;
      }
      function physics(dt) {
        if (!assembled) {
          const elapsed=performance.now()-initial, p=clamp(elapsed/duration,0,1), ease=1-Math.pow(1-p,4);
          for (let i=0;i<pos.length;i++) pos[i]=scene.targets[i]+(pos[i]-scene.targets[i])*(1-ease);
          if (p>=1) { pos.set(scene.targets); assembled=true; }
          gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer); gl.bufferSubData(gl.ARRAY_BUFFER,0,pos); moved=false;
          return;
        }
        const localX = pointer.localX || 0, localY = pointer.localY || 0;
        for (let i=0;i<scene.count;i++) {
          const j=i*3;
          if (pointer.active) {
            const dx=scene.targets[j]+disp[j]-localX, dy=scene.targets[j+1]+disp[j+1]-localY;
            const d2=dx*dx+dy*dy, radius=.28;
            if (d2<radius*radius && d2>1e-6) {
              const d=Math.sqrt(d2), f=9*(1-d/radius)*dt/d;
              vel[j]+=dx*f; vel[j+1]+=dy*f;
              vel[j+2]+=(Math.random()-.5)*f*.3;
            }
          }
          if (performance.now()-shockAt<500) {
            const dx=scene.targets[j]+disp[j]-localX, dy=scene.targets[j+1]+disp[j+1]-localY, d=Math.hypot(dx,dy);
            if (d < .6 && d > .001) { const pulse=Math.max(0,1-(performance.now()-shockAt)/500); vel[j] += dx/d*pulse*dt*1.5; vel[j+1] += dy/d*pulse*dt*1.5; }
          }
          vel[j] += -disp[j]*6*dt; vel[j+1] += -disp[j+1]*6*dt; vel[j+2] += -disp[j+2]*6*dt;
          const damping=Math.pow(.06,dt);
          vel[j]*=damping; vel[j+1]*=damping; vel[j+2]*=damping;
          disp[j]+=vel[j]*dt; disp[j+1]+=vel[j+1]*dt; disp[j+2]+=vel[j+2]*dt;
          pos[j]=scene.targets[j]+disp[j]; pos[j+1]=scene.targets[j+1]+disp[j+1]; pos[j+2]=scene.targets[j+2]+disp[j+2];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer); gl.bufferSubData(gl.ARRAY_BUFFER,0,pos); moved=false;
      }
      function render(time) {
        raf = 0;
        if (!gl || stage.renderer !== renderer) return;
        const dt=clamp((time-last)/1000,.001,.05); last=time;
        const activeMotion = !assembled || kinetic() || moved || pointer.active;
        if (!reducedMotion && activeMotion) {
          frameSum += dt*1000; frameSamples += 1;
          if (frameSamples >= 60) {
            const avg = frameSum/frameSamples; frameSamples = 0; frameSum = 0;
            if (avg > 20 && qualityTier < 2) {
              qualityTier += 1;
              dprCap = qualityTier === 1 ? (mobile ? 1.05 : 1.25) : (mobile ? .9 : 1.0);
              if (qualityTier >= 2) activeCount = Math.max(600,Math.floor(scene.count*.7));
              resize();
            }
          }
        }
        if (activeMotion) physics(dt);
        gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE); gl.disable(gl.DEPTH_TEST);
        gl.useProgram(program);
        if (vao) bindVao(); else {
          setupAttrib(gl,posBuffer,attribs.aPos,3); setupAttrib(gl,colorBuffer,attribs.aCol,3); setupAttrib(gl,sizeBuffer,attribs.aSize,1); setupAttrib(gl,shapeBuffer,attribs.aShape,1);
        }
        const seconds=time/1000;
        const rotY=reducedMotion ? 0 : Math.sin(seconds*.16)*.5;
        const rotX=reducedMotion ? .04 : .04+Math.sin(seconds*.12)*.045;
        gl.uniform1f(uniforms.rotY,rotY);
        gl.uniform1f(uniforms.rotX,rotX);
        gl.uniform1f(uniforms.scale,scale*(reducedMotion ? 1 : 1+.017*Math.sin(seconds*.8)));
        gl.uniform1f(uniforms.dpr,dpr);
        gl.uniform1f(uniforms.time,reducedMotion ? 0 : seconds);
        gl.uniform1f(uniforms.alpha,stage.scene === "robot" ? .92 : .9);
        gl.drawArrays(gl.POINTS,0,activeCount);
        if (!stage.el.classList.contains("is-ready") && !gl.isContextLost()) {
          const err=gl.getError();
          if (err===gl.NO_ERROR) stage.el.classList.add("is-ready");
        }
        if (!reducedMotion) {
          const stillActive = !assembled || kinetic() || moved || pointer.active;
          if (stillActive) raf=window.requestAnimationFrame(render);
          else idleTimer=window.setTimeout(() => {
            idleTimer = 0;
            if (!document.hidden && !paused && stage.renderer === renderer) raf=window.requestAnimationFrame(render);
          },120); // keep a quiet low-rate shimmer without a 60 FPS idle loop
        }
      }
      const renderer = {
        gl, scene, stop() { if (raf) cancelAnimationFrame(raf); if (idleTimer) clearTimeout(idleTimer); raf=0; idleTimer=0; pointerLeave(); },
        start() { if (raf || idleTimer || document.hidden || paused) return; resize(); if (reducedMotion) { assembled=true; pos.set(scene.targets); gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer); gl.bufferSubData(gl.ARRAY_BUFFER,0,pos); moved=false; render(performance.now()); } else raf=window.requestAnimationFrame(render); },
        resize,
        dispose() {
          this.stop();
          try { gl.deleteBuffer(posBuffer); gl.deleteBuffer(colorBuffer); gl.deleteBuffer(sizeBuffer); gl.deleteBuffer(shapeBuffer); gl.deleteProgram(program); if (vao) { if (is2) gl.deleteVertexArray(vao); else vaoExt.deleteVertexArrayOES(vao); } } catch (_) {}
          const ext=gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
          stage.el.classList.remove("is-ready"); stage.renderer=null;
        },
        pointerLeave
      };
      const keyboardActivate = event => {
        if ((event.key === "Enter" || event.key === " ") && stage.scene === "brain") {
          event.preventDefault();
          const rect = stage.el.getBoundingClientRect();
          shockwave({ clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 });
        }
      };
      stage.el.addEventListener("keydown",keyboardActivate);
      stage.el.addEventListener("pointermove",updatePointer,{passive:true});
      stage.el.addEventListener("pointerleave",pointerLeave,{passive:true});
      stage.el.addEventListener("pointerup",pointerLeave,{passive:true});
      stage.el.addEventListener("pointerdown",shockwave,{passive:true});
      window.addEventListener("resize",resize,{passive:true});
      renderer.removeEvents = () => {
        stage.el.removeEventListener("keydown",keyboardActivate); stage.el.removeEventListener("pointermove",updatePointer); stage.el.removeEventListener("pointerleave",pointerLeave); stage.el.removeEventListener("pointerup",pointerLeave); stage.el.removeEventListener("pointerdown",shockwave); window.removeEventListener("resize",resize);
      };
      stage.renderer = renderer;
      renderer.start();
      return renderer;
    } catch (error) {
      try { const ext=gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } catch (_) {}
      console.warn("Aloop particle renderer fell back to SVG:",error);
      return null;
    }
  }
  function makeInteractiveCanvasFallback(stage) {
    // WebGL can be unavailable or blocked by a browser. Use a separate 2D canvas
    // overlay so mouse/touch perturbation and click shockwaves remain functional.
    if (stage.scene !== "brain") return null;
    const canvas = document.createElement("canvas");
    canvas.className = "particle-fallback-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.pointerEvents = "none";
    stage.el.appendChild(canvas);
    let ctx;
    try { ctx = canvas.getContext("2d", { alpha: true, desynchronized: true }); } catch (_) { ctx = null; }
    if (!ctx) { canvas.remove(); return null; }

    const scene = pointsFor("brain");
    const count = Math.min(scene.count, mobile ? 2150 : 4300);
    const step = Math.max(1, Math.floor(scene.count / count));
    const disp = new Float32Array(scene.count * 3);
    const vel = new Float32Array(scene.count * 3);
    let width = 0, height = 0, dpr = 1, raf = 0, timer = 0, running = false;
    let last = performance.now(), shockAt = -Infinity, shockX = 0, shockY = 0;
    const pointer = { active: false, x: 0, y: 0, localX: 0, localY: 0, lastX: 0, lastY: 0, lastAt: 0, speed: 0 };
    const scale = 3.12, modelFactor = scale / 3.5;

    function resize() {
      const rect = stage.el.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function updatePointer(event) {
      const rect = stage.el.getBoundingClientRect();
      pointer.x = clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -1, 1);
      pointer.y = clamp(1 - ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2, -1, 1);
      pointer.active = true;
      const now = performance.now();
      const dt = Math.max(8, now - pointer.lastAt);
      pointer.speed = clamp(Math.hypot(event.clientX - pointer.lastX, event.clientY - pointer.lastY) / dt, 0, 1);
      pointer.lastX = event.clientX; pointer.lastY = event.clientY; pointer.lastAt = now;
      const angle = reducedMotion ? 0 : Math.sin(now * .00016) * .5;
      pointer.localX = (pointer.x / modelFactor) * Math.cos(angle);
      pointer.localY = pointer.y / modelFactor;
      if (Aloop.audio) Aloop.audio.glassGlide((event.clientY - rect.top) / Math.max(1, rect.height), pointer.speed);
      schedule();
    }
    function pointerLeave() {
      pointer.active = false; pointer.speed = 0;
      Aloop.audio?.stopGlassGlide();
      schedule();
    }
    function shockwave(event) {
      const rect = stage.el.getBoundingClientRect();
      shockX = clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -1, 1);
      shockY = clamp(1 - ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2, -1, 1);
      const lx = shockX / modelFactor, ly = shockY / modelFactor;
      shockAt = performance.now();
      stage.el.style.setProperty("--shock-x", `${(shockX + 1) * 50}%`);
      stage.el.style.setProperty("--shock-y", `${(1 - shockY) * 50}%`);
      stage.el.classList.remove("has-shockwave"); void stage.el.offsetWidth; stage.el.classList.add("has-shockwave");
      window.setTimeout(() => stage.el.classList.remove("has-shockwave"), 700);
      for (let i = 0; i < count; i++) {
        const j = i * 3, dx = scene.targets[j] - lx, dy = scene.targets[j + 1] - ly;
        const dist = Math.hypot(dx, dy);
        if (dist < .6 && dist > .001) {
          const force = (1 - dist / .6) * .48;
          vel[j] += dx / dist * force; vel[j + 1] += dy / dist * force;
        }
      }
      Aloop.audio?.tink();
      schedule();
    }
    function draw(time) {
      if (!width || !height) resize();
      const dt = clamp((time - last) / 1000, .001, .05); last = time;
      const seconds = time / 1000;
      const rotY = reducedMotion ? 0 : Math.sin(seconds * .16) * .5;
      const rotX = reducedMotion ? .04 : .04 + Math.sin(seconds * .12) * .045;
      const cx = Math.cos(rotX), sx = Math.sin(rotX), cy = Math.cos(rotY), sy = Math.sin(rotY);
      const active = pointer.active || time - shockAt < 500;
      if (active || !reducedMotion) {
        for (let i = 0; i < count; i++) {
          const j = i * 3;
          if (pointer.active) {
            const dx = scene.targets[j] + disp[j] - pointer.localX;
            const dy = scene.targets[j + 1] + disp[j + 1] - pointer.localY;
            const d2 = dx * dx + dy * dy, radius = .28;
            if (d2 < radius * radius && d2 > 1e-6) {
              const d = Math.sqrt(d2), force = 9 * (1 - d / radius) * dt / d;
              vel[j] += dx * force; vel[j + 1] += dy * force;
              vel[j + 2] += (Math.random() - .5) * force * .25;
            }
          }
          if (time - shockAt < 500) {
            const dx = scene.targets[j] + disp[j] - shockX / modelFactor;
            const dy = scene.targets[j + 1] + disp[j + 1] - shockY / modelFactor;
            const dist = Math.hypot(dx, dy);
            if (dist < .6 && dist > .001) {
              const pulse = Math.max(0, 1 - (time - shockAt) / 500);
              vel[j] += dx / dist * pulse * dt * 1.5;
              vel[j + 1] += dy / dist * pulse * dt * 1.5;
            }
          }
          vel[j] += -disp[j] * 6 * dt; vel[j + 1] += -disp[j + 1] * 6 * dt; vel[j + 2] += -disp[j + 2] * 6 * dt;
          const damping = Math.pow(.06, dt);
          vel[j] *= damping; vel[j + 1] *= damping; vel[j + 2] *= damping;
          disp[j] += vel[j] * dt; disp[j + 1] += vel[j + 1] * dt; disp[j + 2] += vel[j + 2] * dt;
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const backGlow = ctx.createRadialGradient(width * .55, height * .44, 0, width * .55, height * .44, Math.max(width, height) * .58);
      backGlow.addColorStop(0, "rgba(49,94,145,.065)");
      backGlow.addColorStop(.56, "rgba(242,204,77,.035)");
      backGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = backGlow; ctx.fillRect(0, 0, width, height);
      ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = .78;

      for (let i = 0; i < count; i += step) {
        const j = i * 3;
        let px = scene.targets[j] + disp[j], py = scene.targets[j + 1] + disp[j + 1], pz = scene.targets[j + 2] + disp[j + 2];
        const y1 = py * cx - pz * sx, z1 = py * sx + pz * cx;
        const x2 = px * cy + z1 * sy, z2 = -px * sy + z1 * cy;
        const factor = scale / Math.max(1.6, 3.5 - z2);
        const x = (x2 * factor + 1) * width * .5, y = (1 - y1 * factor) * height * .5;
        const shape = scene.shapes[i] || 1;
        const radius = clamp(scene.sizes[i] * factor * 2.05, 1.15, 4.8);
        const r = Math.round(clamp(scene.colors[j], 0, 1) * 255);
        const g = Math.round(clamp(scene.colors[j + 1], 0, 1) * 255);
        const b = Math.round(clamp(scene.colors[j + 2], 0, 1) * 255);
        const alpha = .65 + .35 * Math.sin(seconds * 1.2 + i * .071);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        if (shape < 1.5) {
          ctx.moveTo(x, y - radius); ctx.lineTo(x - radius * .86, y + radius * .7); ctx.lineTo(x + radius * .86, y + radius * .7); ctx.closePath();
        } else if (shape < 2.5) {
          ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y); ctx.closePath();
        } else {
          ctx.rect(x - radius * .72, y - radius * .72, radius * 1.44, radius * 1.44);
        }
        ctx.stroke();
        if (i % 17 === 0) {
          ctx.globalAlpha = .16 * alpha;
          ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      stage.el.classList.add("fallback-interactive", "is-ready");
    }
    function loop() {
      if (!running || document.hidden || !stage.near) return;
      timer = window.setTimeout(() => {
        timer = 0;
        if (!running || document.hidden || !stage.near) return;
        raf = window.requestAnimationFrame(time => {
          raf = 0; draw(time);
          if (!reducedMotion || pointer.active || performance.now() - shockAt <= 520) loop();
        });
      }, 33);
    }
    function schedule() {
      if (!running || raf || timer || document.hidden || !stage.near) return;
      if (reducedMotion && !pointer.active && performance.now() - shockAt > 520) {
        raf = window.requestAnimationFrame(time => { raf = 0; draw(time); });
      } else loop();
    }
    function start() {
      if (running || document.hidden || !stage.near) return;
      running = true; resize(); draw(performance.now());
      if (!reducedMotion) loop();
    }
    function stop() {
      running = false; pointerLeave();
      if (timer) window.clearTimeout(timer); if (raf) window.cancelAnimationFrame(raf);
      timer = 0; raf = 0;
    }
    function onResize() { resize(); draw(performance.now()); }
    function keyboardActivate(event) {
      if ((event.key === "Enter" || event.key === " ") && stage.scene === "brain") {
        event.preventDefault(); const rect = stage.el.getBoundingClientRect();
        shockwave({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
      }
    }
    stage.el.addEventListener("pointermove", updatePointer, { passive: true });
    stage.el.addEventListener("pointerleave", pointerLeave, { passive: true });
    stage.el.addEventListener("pointercancel", pointerLeave, { passive: true });
    stage.el.addEventListener("pointerup", pointerLeave, { passive: true });
    stage.el.addEventListener("pointerdown", shockwave, { passive: true });
    stage.el.addEventListener("keydown", keyboardActivate);
    window.addEventListener("resize", onResize, { passive: true });
    const renderer = {
      start, stop, resize: onResize,
      removeEvents() {
        stage.el.removeEventListener("pointermove", updatePointer); stage.el.removeEventListener("pointerleave", pointerLeave);
        stage.el.removeEventListener("pointercancel", pointerLeave); stage.el.removeEventListener("pointerup", pointerLeave);
        stage.el.removeEventListener("pointerdown", shockwave); stage.el.removeEventListener("keydown", keyboardActivate);
        window.removeEventListener("resize", onResize);
      },
      dispose() {
        stop(); canvas.remove(); stage.el.classList.remove("fallback-interactive", "is-ready", "has-shockwave");
      }
    };
    stage.renderer = renderer;
    renderer.start();
    return renderer;
  }

  function renderStaticDotFallback(stage) {
    const fallback = stage.el.querySelector(".particle-fallback");
    if (!fallback) return;
    const scene = pointsFor(stage.scene);
    const mask = masks[stage.scene];
    const viewBox = fallback.viewBox && fallback.viewBox.baseVal;
    const width = viewBox && viewBox.width ? viewBox.width : mask.width;
    const height = viewBox && viewBox.height ? viewBox.height : mask.height;
    const scaleX = stage.scene === "robot" ? 1.42 : 1.92;
    const scaleY = stage.scene === "robot" ? 1.42 : 1.48;
    const stride = Math.max(1, Math.ceil(scene.count / (stage.scene === "robot" ? 700 : 1100)));
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    for (let i = 0; i < scene.count; i += stride) {
      const x = (scene.targets[i * 3] / scaleX + .5) * width;
      const y = (.5 - scene.targets[i * 3 + 1] / scaleY) * height;
      const color = Array.from(scene.colors.slice(i * 3, i * 3 + 3), value => Math.round(clamp(value, 0, 1) * 255));
      const shape = scene.shapes[i] || 1;
      const radius = 0.85 + scene.sizes[i] * 0.52;
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      let vertices;
      if (shape < 1.5) vertices = [[0,-1],[-0.88,0.72],[0.88,0.72]];
      else if (shape < 2.5) vertices = [[0,-1],[1,0],[0,1],[-1,0]];
      else vertices = [[-0.78,-0.78],[0.78,-0.78],[0.78,0.78],[-0.78,0.78]];
      polygon.setAttribute("points", vertices.map(([dx,dy]) => `${(x + dx * radius).toFixed(2)},${(y + dy * radius).toFixed(2)}`).join(" "));
      polygon.setAttribute("fill", "none");
      polygon.setAttribute("stroke", `rgb(${color.join(",")})`);
      polygon.setAttribute("stroke-width", (0.48 + scene.sizes[i] * 0.1).toFixed(2));
      polygon.setAttribute("stroke-linejoin", "round");
      polygon.setAttribute("opacity", (.7 + Math.random() * .3).toFixed(2));
      group.appendChild(polygon);
    }
    fallback.replaceChildren(group);
    fallback.dataset.staticDots = "true";
  }
  function release(stage) {
    if (stage.renderer) {
      stage.renderer.removeEvents?.(); stage.renderer.dispose();
      stage.renderer=null;
    }
  }
  function activate(stage) {
    if (paused || document.hidden || stage.renderer || !stage.near) return;
    const live=Array.from(stages.values()).filter(s=>s.renderer);
    if (live.length>=MAX_LIVE_CONTEXTS) {
      const candidate=live.find(s=>!s.near) || live.slice().sort((a,b)=>a.lastSeen-b.lastSeen)[0];
      if (candidate) release(candidate);
    }
    stage.lastSeen=++serial;
    const renderer=makeRenderer(stage);
    if (!renderer) {
      if (stage.scene === "brain") {
        try {
          const interactiveFallback = makeInteractiveCanvasFallback(stage);
          if (interactiveFallback) { stage.el.classList.remove("fallback-only"); return; }
        } catch (error) { console.warn("Aloop interactive 2D fallback unavailable; using static dots.", error); }
      }
      const fallback = stage.el.querySelector(".particle-fallback");
      const needsFallback = !stage.el.classList.contains("fallback-only") || !fallback || fallback.dataset.staticDots !== "true";
      stage.el.classList.add("fallback-only");
      if (needsFallback) {
        try { renderStaticDotFallback(stage); }
        catch (error) { console.warn("Aloop static particle fallback unavailable; using the embedded SVG.", error); }
      }
    } else stage.el.classList.remove("fallback-only", "fallback-interactive");
  }
  function observe() {
    if (observer) observer.disconnect();
    if (!("IntersectionObserver" in window)) {
      Array.from(stages.values()).slice(0,MAX_LIVE_CONTEXTS).forEach(stage=>{stage.near=true;activate(stage);});
      return;
    }
    observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const stage=stages.get(entry.target);
        if (!stage) return;
        stage.near=entry.isIntersecting;
        if (stage.near) activate(stage); else release(stage);
      });
    },{rootMargin:"50% 0px 50% 0px",threshold:0});
    stages.forEach(stage=>observer.observe(stage.el));
  }
  function refresh() {
    stages.forEach((stage,el)=>{ if (!el.isConnected) { release(stage); stages.delete(el); } });
    document.querySelectorAll("[data-particle-stage]").forEach(el=>{
      if (stages.has(el)) return;
      const canvas=el.querySelector(".particle-canvas");
      if (!canvas) return;
      stages.set(el,{el,canvas,scene:el.dataset.scene || "brain",renderer:null,near:false,lastSeen:0});
    });
    observe();
  }
  function pauseAll(value) {
    paused=Boolean(value);
    if (paused) stages.forEach(release);
    else observe();
  }
  document.addEventListener("visibilitychange",()=>{
    if (document.hidden) stages.forEach(stage=>stage.renderer?.stop());
    else if (!paused) stages.forEach(stage=>{ if(stage.near) stage.renderer?.start(); });
  });
  window.addEventListener("pagehide",()=>stages.forEach(release));
  window.AloopGL={refresh,pauseAll,releaseAll(){stages.forEach(release);},getLiveCount(){return Array.from(stages.values()).filter(s=>s.renderer).length;}};
})();
