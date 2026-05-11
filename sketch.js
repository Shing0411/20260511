// sketch.js
// 需要 p5.js + ml5.js
// 功能：京劇換臉、臉譜覆蓋、保留眼睛與嘴巴、手勢揮動換臉

let video;
let faceMesh;
let handPose;

let faces = [];
let hands = [];

let faceImgs = [];
let currentFace = 1;

let videoW;
let videoH;
let videoX;
let videoY;

let lastHandX = null;
let lastHandY = null;
let waveCooldown = 0;

function preload() {
  faceMesh = ml5.faceMesh({
    maxFaces: 1,
    refineLandmarks: true,
    flipped: true
  });

  handPose = ml5.handPose({
    maxHands: 1,
    flipped: true
  });

  // 載入 Face 資料夾裡的 6 張臉譜
  // 檔名：01.png、02.png、03.png、04.png、05.png、06.png
  for (let i = 1; i <= 6; i++) {
    let fileName = nf(i, 2);
    faceImgs[i] = loadImage("Face/" + fileName + ".png");
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  faceMesh.detectStart(video, gotFaces);
  handPose.detectStart(video, gotHands);
}

function draw() {
  background("#BBFFBB");

  setVideoArea();

  drawMirrorVideo();

  detectHandWaveToChangeFace();

  drawPekingOperaMask();

  drawInfoText();

  if (waveCooldown > 0) {
    waveCooldown--;
  }
}

function gotFaces(results) {
  faces = results;
}

function gotHands(results) {
  hands = results;
}

function setVideoArea() {
  videoW = width * 0.5;
  videoH = height * 0.5;

  let ratio = 4 / 3;

  if (videoW / videoH > ratio) {
    videoW = videoH * ratio;
  } else {
    videoH = videoW / ratio;
  }

  videoX = width / 2 - videoW / 2;
  videoY = height / 2 - videoH / 2;
}

function drawMirrorVideo() {
  push();
  translate(videoX + videoW, videoY);
  scale(-1, 1);
  image(video, 0, 0, videoW, videoH);
  pop();
}

function drawPekingOperaMask() {
  if (faces.length === 0) return;

  let face = faces[0];
  if (!face.keypoints) return;

  let k = face.keypoints;

  // 臉部主要定位點
  let top = getPoint(k[10]);       // 額頭上方
  let chin = getPoint(k[152]);     // 下巴
  let leftSide = getPoint(k[234]); // 左臉側
  let rightSide = getPoint(k[454]); // 右臉側

  if (!top || !chin || !leftSide || !rightSide) return;

  let faceCenterX = (leftSide.x + rightSide.x) / 2;
  let faceCenterY = (top.y + chin.y) / 2;

  let faceWidth = dist(leftSide.x, leftSide.y, rightSide.x, rightSide.y);
  let faceHeight = dist(top.x, top.y, chin.x, chin.y);

  let maskW = faceWidth * 1.45;
  let maskH = faceHeight * 1.45;

  // 讓臉譜稍微往下，貼近整張臉
  let maskX = faceCenterX;
  let maskY = faceCenterY + faceHeight * 0.04;

  // 根據臉的左右傾斜角度旋轉臉譜
  let angle = atan2(rightSide.y - leftSide.y, rightSide.x - leftSide.x);

  let img = faceImgs[currentFace];

  if (img) {
    push();
    imageMode(CENTER);
    translate(maskX, maskY);
    rotate(angle);
    image(img, 0, 0, maskW, maskH);
    pop();
  }

  // 將真實眼睛與嘴巴重新露出來
  // 這樣睜眼、閉眼、張嘴時，就會跟著真人畫面變化
  drawRealEyesAndMouth(k);
}

function drawRealEyesAndMouth(k) {
  // 左眼參考點
  let leftEyeA = getPoint(k[33]);
  let leftEyeB = getPoint(k[133]);
  let leftEyeTop = getPoint(k[159]);
  let leftEyeBottom = getPoint(k[145]);

  // 右眼參考點
  let rightEyeA = getPoint(k[362]);
  let rightEyeB = getPoint(k[263]);
  let rightEyeTop = getPoint(k[386]);
  let rightEyeBottom = getPoint(k[374]);

  // 嘴巴參考點
  let mouthL = getPoint(k[61]);
  let mouthR = getPoint(k[291]);
  let mouthTop = getPoint(k[13]);
  let mouthBottom = getPoint(k[14]);

  if (
    !leftEyeA || !leftEyeB || !leftEyeTop || !leftEyeBottom ||
    !rightEyeA || !rightEyeB || !rightEyeTop || !rightEyeBottom ||
    !mouthL || !mouthR || !mouthTop || !mouthBottom
  ) {
    return;
  }

  let leftEyeCX = (leftEyeA.x + leftEyeB.x) / 2;
  let leftEyeCY = (leftEyeTop.y + leftEyeBottom.y) / 2;

  let rightEyeCX = (rightEyeA.x + rightEyeB.x) / 2;
  let rightEyeCY = (rightEyeTop.y + rightEyeBottom.y) / 2;

  let leftEyeW = dist(leftEyeA.x, leftEyeA.y, leftEyeB.x, leftEyeB.y) * 1.7;
  let leftEyeH = max(18, abs(leftEyeBottom.y - leftEyeTop.y) * 3.2);

  let rightEyeW = dist(rightEyeA.x, rightEyeA.y, rightEyeB.x, rightEyeB.y) * 1.7;
  let rightEyeH = max(18, abs(rightEyeBottom.y - rightEyeTop.y) * 3.2);

  let mouthCX = (mouthL.x + mouthR.x) / 2;
  let mouthCY = (mouthTop.y + mouthBottom.y) / 2;

  let mouthW = dist(mouthL.x, mouthL.y, mouthR.x, mouthR.y) * 1.35;
  let mouthH = max(22, abs(mouthBottom.y - mouthTop.y) * 3.8);

  // 露出真實左眼
  drawVideoInsideEllipse(leftEyeCX, leftEyeCY, leftEyeW, leftEyeH);

  // 露出真實右眼
  drawVideoInsideEllipse(rightEyeCX, rightEyeCY, rightEyeW, rightEyeH);

  // 露出真實嘴巴
  drawVideoInsideEllipse(mouthCX, mouthCY, mouthW, mouthH);

  // 加一點細框，讓眼睛嘴巴比較自然
  noFill();
  stroke(0, 80);
  strokeWeight(2);
  ellipse(leftEyeCX, leftEyeCY, leftEyeW, leftEyeH);
  ellipse(rightEyeCX, rightEyeCY, rightEyeW, rightEyeH);
  ellipse(mouthCX, mouthCY, mouthW, mouthH);
}

function drawVideoInsideEllipse(cx, cy, w, h) {
  drawingContext.save();

  drawingContext.beginPath();
  drawingContext.ellipse(
    cx,
    cy,
    w / 2,
    h / 2,
    0,
    0,
    Math.PI * 2
  );
  drawingContext.clip();

  drawMirrorVideo();

  drawingContext.restore();
}

function detectHandWaveToChangeFace() {
  if (hands.length === 0) {
    lastHandX = null;
    lastHandY = null;
    return;
  }

  if (faces.length === 0) return;

  let hand = hands[0];
  let face = faces[0];

  if (!hand.keypoints || !face.keypoints) return;

  let handCenter = getHandCenter(hand.keypoints);
  let faceBox = getFaceBox(face.keypoints);

  if (!handCenter || !faceBox) return;

  // 判斷手是否沒有擋在臉前面
  let handInFace =
    handCenter.x > faceBox.x &&
    handCenter.x < faceBox.x + faceBox.w &&
    handCenter.y > faceBox.y &&
    handCenter.y < faceBox.y + faceBox.h;

  // 只有手不在臉前面，才允許揮手換臉
  if (!handInFace && lastHandX !== null && waveCooldown === 0) {
    let moveX = abs(handCenter.x - lastHandX);
    let moveY = abs(handCenter.y - lastHandY);

    // 左右揮動幅度夠大，就換臉
    if (moveX > 80 && moveY < 120) {
      changeFace();
      waveCooldown = 35;
    }
  }

  lastHandX = handCenter.x;
  lastHandY = handCenter.y;
}

function changeFace() {
  currentFace++;

  if (currentFace > 6) {
    currentFace = 1;
  }
}

function getHandCenter(points) {
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < points.length; i++) {
    let p = getPoint(points[i]);
    sumX += p.x;
    sumY += p.y;
  }

  return createVector(sumX / points.length, sumY / points.length);
}

function getFaceBox(points) {
  let xs = [];
  let ys = [];

  for (let i = 0; i < points.length; i++) {
    let p = getPoint(points[i]);
    xs.push(p.x);
    ys.push(p.y);
  }

  let minX = min(xs);
  let maxX = max(xs);
  let minY = min(ys);
  let maxY = max(ys);

  let boxW = maxX - minX;
  let boxH = maxY - minY;

  // 稍微放大臉部範圍，避免手靠近臉時誤判
  return {
    x: minX - boxW * 0.15,
    y: minY - boxH * 0.15,
    w: boxW * 1.3,
    h: boxH * 1.3
  };
}

function getPoint(point) {
  if (!point) return null;

  let x = map(point.x, 0, video.width, videoX, videoX + videoW);
  let y = map(point.y, 0, video.height, videoY, videoY + videoH);

  return createVector(x, y);
}

function drawInfoText() {
  fill(0);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(22);

  text(
    "京劇換臉：手在臉旁邊揮一下可換臉，目前 Face/" + nf(currentFace, 2) + ".png",
    width / 2,
    videoY + videoH + 45
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
