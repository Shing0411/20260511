// sketch.js
// 需要搭配 p5.js + ml5.js
// 功能：京劇換臉 + 耳環 + 手勢切換耳環 + 揮手換臉 + 顯示姓名學號

let video;
let faceMesh;
let handPose;

let faces = [];
let hands = [];

let faceImgs = [];
let earrings = [];

let currentFace = 1;
let currentAcc = 1;

let videoW;
let videoH;
let videoX;
let videoY;

// 揮手偵測用
let handHistory = [];
let waveCooldown = 0;

function preload() {
  // FaceMesh 臉部辨識
  faceMesh = ml5.faceMesh({
    maxFaces: 1,
    refineLandmarks: true,
    flipped: true
  });

  // HandPose 手部辨識
  handPose = ml5.handPose({
    maxHands: 1,
    flipped: true
  });

  // 載入京劇臉譜 Face/01.png ～ Face/06.png
  for (let i = 1; i <= 6; i++) {
    let fileName = nf(i, 2);
    faceImgs[i] = loadImage("Face/" + fileName + ".png");
  }

  // 載入耳環 earrings/acc1.png ～ earrings/acc5.png
  for (let i = 1; i <= 5; i++) {
    earrings[i] = loadImage("earrings/acc" + i + ".png");
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

  // 手比 1～5 換耳環
  detectHandGesture();

  // 手在臉旁邊揮動換臉
  detectHandWaveToChangeFace();

  // 畫京劇臉譜
  drawPekingOperaMask();

  // 畫耳環
  drawEarrings();

  // 畫面說明文字
  drawInfoText();

  // 顯示學號姓名
  drawNameText();

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

// 設定攝影機畫面位置與大小
function setVideoArea() {
  videoW = width * 0.5;
  videoH = height * 0.5;

  // 維持 4:3，避免畫面變形
  let ratio = 4 / 3;

  if (videoW / videoH > ratio) {
    videoW = videoH * ratio;
  } else {
    videoH = videoW / ratio;
  }

  videoX = width / 2 - videoW / 2;
  videoY = height / 2 - videoH / 2;
}

// 畫左右鏡像攝影機
function drawMirrorVideo() {
  push();
  translate(videoX + videoW, videoY);
  scale(-1, 1);
  image(video, 0, 0, videoW, videoH);
  pop();
}

// 畫京劇臉譜
function drawPekingOperaMask() {
  if (faces.length === 0) return;

  let face = faces[0];
  if (!face.keypoints) return;

  let k = face.keypoints;

  // 臉部定位點
  let top = getPoint(k[10]);
  let chin = getPoint(k[152]);
  let leftSide = getPoint(k[234]);
  let rightSide = getPoint(k[454]);

  if (!top || !chin || !leftSide || !rightSide) return;

  let faceCenterX = (leftSide.x + rightSide.x) / 2;
  let faceCenterY = (top.y + chin.y) / 2;

  let faceWidth = dist(leftSide.x, leftSide.y, rightSide.x, rightSide.y);
  let faceHeight = dist(top.x, top.y, chin.x, chin.y);

  let maskW = faceWidth * 1.45;
  let maskH = faceHeight * 1.45;

  let maskX = faceCenterX;
  let maskY = faceCenterY + faceHeight * 0.04;

  // 讓臉譜跟著臉傾斜
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

  // 露出真實眼睛與嘴巴
  drawRealEyesAndMouth(k);
}

// 露出真實眼睛與嘴巴
function drawRealEyesAndMouth(k) {
  // 左眼
  let leftEyeA = getPoint(k[33]);
  let leftEyeB = getPoint(k[133]);
  let leftEyeTop = getPoint(k[159]);
  let leftEyeBottom = getPoint(k[145]);

  // 右眼
  let rightEyeA = getPoint(k[362]);
  let rightEyeB = getPoint(k[263]);
  let rightEyeTop = getPoint(k[386]);
  let rightEyeBottom = getPoint(k[374]);

  // 嘴巴
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

  // 眼睛嘴巴外框
  noFill();
  stroke(0, 80);
  strokeWeight(2);
  ellipse(leftEyeCX, leftEyeCY, leftEyeW, leftEyeH);
  ellipse(rightEyeCX, rightEyeCY, rightEyeW, rightEyeH);
  ellipse(mouthCX, mouthCY, mouthW, mouthH);
}

// 在橢圓形區域內重新顯示真實影像
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

// 畫耳環
function drawEarrings() {
  if (faces.length === 0) return;

  let face = faces[0];
  if (!face.keypoints) return;

  let k = face.keypoints;

  // 234、454 接近左右耳旁
  let leftEarPoint = k[234];
  let rightEarPoint = k[454];

  if (!leftEarPoint || !rightEarPoint) return;

  let leftEar = getPoint(leftEarPoint);
  let rightEar = getPoint(rightEarPoint);

  // 往下移動，比較像耳垂位置
  leftEar.y += videoH * 0.06;
  rightEar.y += videoH * 0.06;

  // 黃色圓圈標示耳垂
  fill(255, 230, 0);
  stroke(255);
  strokeWeight(3);
  circle(leftEar.x, leftEar.y, 24);
  circle(rightEar.x, rightEar.y, 24);

  let accImg = earrings[currentAcc];

  if (accImg) {
    imageMode(CENTER);

    let earringSize = videoW * 0.1;

    image(
      accImg,
      leftEar.x,
      leftEar.y + earringSize * 0.35,
      earringSize,
      earringSize
    );

    image(
      accImg,
      rightEar.x,
      rightEar.y + earringSize * 0.35,
      earringSize,
      earringSize
    );

    imageMode(CORNER);
  }
}

// 偵測手比數字，切換耳環
function detectHandGesture() {
  if (hands.length === 0) return;

  let hand = hands[0];
  if (!hand.keypoints) return;

  let fingers = getFingerStates(hand);
  let number = countFingers(fingers);

  // 比 1～5，切換耳環
  if (number >= 1 && number <= 5) {
    currentAcc = number;
  }
}

// 判斷五根手指是否伸直
function getFingerStates(hand) {
  let k = hand.keypoints;

  let fingers = {
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false
  };

  // 食指
  fingers.index = k[8].y < k[6].y;

  // 中指
  fingers.middle = k[12].y < k[10].y;

  // 無名指
  fingers.ring = k[16].y < k[14].y;

  // 小指
  fingers.pinky = k[20].y < k[18].y;

  // 大拇指
  let wrist = k[0];
  let thumbTip = k[4];
  let thumbBase = k[2];

  let thumbDistance = dist(
    thumbTip.x,
    thumbTip.y,
    wrist.x,
    wrist.y
  );

  let thumbBaseDistance = dist(
    thumbBase.x,
    thumbBase.y,
    wrist.x,
    wrist.y
  );

  fingers.thumb = thumbDistance > thumbBaseDistance + 25;

  return fingers;
}

// 計算伸出的手指數量
function countFingers(fingers) {
  let count = 0;

  if (fingers.thumb) count++;
  if (fingers.index) count++;
  if (fingers.middle) count++;
  if (fingers.ring) count++;
  if (fingers.pinky) count++;

  return count;
}

// 偵測手在臉旁邊揮動，切換京劇臉譜
function detectHandWaveToChangeFace() {
  if (hands.length === 0) {
    handHistory = [];
    return;
  }

  if (faces.length === 0) return;

  let hand = hands[0];
  let face = faces[0];

  if (!hand.keypoints || !face.keypoints) return;

  let handCenter = getHandCenter(hand.keypoints);
  let faceBox = getFaceBox(face.keypoints);

  if (!handCenter || !faceBox) return;

  // 判斷手是否擋在臉上
  let handInFace =
    handCenter.x > faceBox.x &&
    handCenter.x < faceBox.x + faceBox.w &&
    handCenter.y > faceBox.y &&
    handCenter.y < faceBox.y + faceBox.h;

  // 手擋住臉，不換臉
  if (handInFace) {
    handHistory = [];
    return;
  }

  let faceCenterX = faceBox.x + faceBox.w / 2;
  let faceCenterY = faceBox.y + faceBox.h / 2;

  // 手要在臉旁邊，不要離太遠
  let handNearFace =
    abs(handCenter.x - faceCenterX) < faceBox.w * 1.8 &&
    abs(handCenter.y - faceCenterY) < faceBox.h * 1.3;

  if (!handNearFace) {
    handHistory = [];
    return;
  }

  // 記錄手的位置
  handHistory.push({
    x: handCenter.x,
    y: handCenter.y
  });

  // 保留最近 12 筆位置
  if (handHistory.length > 12) {
    handHistory.shift();
  }

  if (handHistory.length < 8) return;

  let xs = handHistory.map(p => p.x);
  let ys = handHistory.map(p => p.y);

  let moveX = max(xs) - min(xs);
  let moveY = max(ys) - min(ys);

  // 左右揮動夠大，就換臉
  if (waveCooldown === 0 && moveX > 55 && moveY < 200) {
    changeFace();

    waveCooldown = 45;
    handHistory = [];
  }
}

// 換下一張臉譜
function changeFace() {
  currentFace++;

  if (currentFace > 6) {
    currentFace = 1;
  }
}

// 取得手掌中心
function getHandCenter(points) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let i = 0; i < points.length; i++) {
    let p = getPoint(points[i]);

    if (p) {
      sumX += p.x;
      sumY += p.y;
      count++;
    }
  }

  if (count === 0) return null;

  return createVector(sumX / count, sumY / count);
}

// 取得臉部範圍
function getFaceBox(points) {
  let xs = [];
  let ys = [];

  for (let i = 0; i < points.length; i++) {
    let p = getPoint(points[i]);

    if (p) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }

  if (xs.length === 0 || ys.length === 0) return null;

  let minX = min(xs);
  let maxX = max(xs);
  let minY = min(ys);
  let maxY = max(ys);

  let boxW = maxX - minX;
  let boxH = maxY - minY;

  return {
    x: minX - boxW * 0.15,
    y: minY - boxH * 0.15,
    w: boxW * 1.3,
    h: boxH * 1.3
  };
}

// 將 ml5 偵測座標轉換成畫布座標
function getPoint(point) {
  if (!point) return null;

  let x = map(point.x, 0, video.width, videoX, videoX + videoW);
  let y = map(point.y, 0, video.height, videoY, videoY + videoH);

  return createVector(x, y);
}

// 顯示功能說明文字
function drawInfoText() {
  fill(0);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(20);

  text(
    "手比 1～5 換耳環，目前 acc" +
      currentAcc +
      ".png｜手在臉旁邊左右揮動換臉，目前 Face/" +
      nf(currentFace, 2) +
      ".png",
    width / 2,
    videoY + videoH + 45
  );
}

// 顯示學號姓名
function drawNameText() {
  push();

  let labelText = "414736529 王家興";

  textAlign(CENTER, CENTER);
  textSize(28);
  textStyle(BOLD);

  let boxW = textWidth(labelText) + 50;
  let boxH = 50;

  // 白色半透明底框
  fill(255, 255, 255, 220);
  stroke(0);
  strokeWeight(2);
  rectMode(CENTER);
  rect(width / 2, 45, boxW, boxH, 12);

  // 黑色文字
  fill(0);
  noStroke();
  text(labelText, width / 2, 45);

  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
