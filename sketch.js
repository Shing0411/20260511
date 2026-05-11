// sketch.js
// 需要使用 p5.js + ml5.js
// 功能：攝影機畫面置中、左右鏡像、偵測耳垂、手勢切換耳環

let video;
let faceMesh;
let handPose;

let faces = [];
let hands = [];

let earrings = [];
let currentAcc = 1;

let videoW;
let videoH;
let videoX;
let videoY;

function preload() {
  // 載入 FaceMesh 模型
  faceMesh = ml5.faceMesh({
    maxFaces: 1,
    refineLandmarks: true,
    flipped: true
  });

  // 載入 HandPose 模型
  handPose = ml5.handPose({
    maxHands: 1,
    flipped: true
  });

  // 載入 earrings 資料夾中的五個耳環圖片
  for (let i = 1; i <= 5; i++) {
    earrings[i] = loadImage("earrings/acc" + i + ".png");
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 開啟攝影機
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // 開始偵測臉部
  faceMesh.detectStart(video, gotFaces);

  // 開始偵測手部
  handPose.detectStart(video, gotHands);
}

function draw() {
  background("#BBFFBB");

  // 攝影機影像寬高為全螢幕的 50%
  videoW = width * 0.5;
  videoH = height * 0.5;

  // 維持攝影機 4:3 比例，避免畫面變形
  let ratio = 4 / 3;

  if (videoW / videoH > ratio) {
    videoW = videoH * ratio;
  } else {
    videoH = videoW / ratio;
  }

  // 讓攝影機畫面置中
  videoX = width / 2 - videoW / 2;
  videoY = height / 2 - videoH / 2;

  // 顯示左右顛倒的攝影機畫面
  push();
  translate(videoX + videoW, videoY);
  scale(-1, 1);
  image(video, 0, 0, videoW, videoH);
  pop();

  // 偵測手勢，決定要戴哪一個耳環
  detectHandGesture();

  // 偵測耳垂並畫上耳環
  drawEarrings();

  // 畫面說明文字
  drawTextInfo();
}

function gotFaces(results) {
  faces = results;
}

function gotHands(results) {
  hands = results;
}

function drawEarrings() {
  if (faces.length === 0) return;

  let face = faces[0];

  if (!face.keypoints) return;

  // 使用 FaceMesh 臉部邊緣點模擬左右耳垂位置
  // 234 接近左耳位置
  // 454 接近右耳位置
  let leftEarPoint = face.keypoints[234];
  let rightEarPoint = face.keypoints[454];

  if (!leftEarPoint || !rightEarPoint) return;

  let leftEar = convertPoint(leftEarPoint);
  let rightEar = convertPoint(rightEarPoint);

  // 讓位置往下移動一點，比較像耳垂
  leftEar.y += videoH * 0.06;
  rightEar.y += videoH * 0.06;

  // 畫黃色圓圈在耳垂位置
  fill(255, 230, 0);
  stroke(255);
  strokeWeight(3);
  circle(leftEar.x, leftEar.y, 28);
  circle(rightEar.x, rightEar.y, 28);

  // 取得目前選擇的耳環圖片
  let accImg = earrings[currentAcc];

  if (accImg) {
    imageMode(CENTER);

    // 耳環大小
    let earringSize = videoW * 0.12;

    // 左耳耳環
    image(
      accImg,
      leftEar.x,
      leftEar.y + earringSize * 0.35,
      earringSize,
      earringSize
    );

    // 右耳耳環
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

function convertPoint(point) {
  // 將 FaceMesh 偵測座標轉換到畫布上的攝影機位置
  let x = map(point.x, 0, video.width, videoX, videoX + videoW);
  let y = map(point.y, 0, video.height, videoY, videoY + videoH);

  return createVector(x, y);
}

function detectHandGesture() {
  if (hands.length === 0) return;

  let hand = hands[0];

  if (!hand.keypoints) return;

  let fingers = getFingerStates(hand);
  let number = countFingers(fingers);

  // 手比 1～5，切換 acc1.png～acc5.png
  if (number >= 1 && number <= 5) {
    currentAcc = number;
  }
}

function getFingerStates(hand) {
  let k = hand.keypoints;

  let fingers = {
    thumb: false,
    index: false,
    middle: false,
    ring: false,
    pinky: false
  };

  // 食指伸直
  fingers.index = k[8].y < k[6].y;

  // 中指伸直
  fingers.middle = k[12].y < k[10].y;

  // 無名指伸直
  fingers.ring = k[16].y < k[14].y;

  // 小指伸直
  fingers.pinky = k[20].y < k[18].y;

  // 大拇指伸直
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

function countFingers(fingers) {
  let count = 0;

  if (fingers.thumb) count++;
  if (fingers.index) count++;
  if (fingers.middle) count++;
  if (fingers.ring) count++;
  if (fingers.pinky) count++;

  return count;
}

function drawTextInfo() {
  fill(0);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(22);

  text(
    "手比數字 1～5，可切換耳環：目前 acc" + currentAcc + ".png",
    width / 2,
    videoY + videoH + 45
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}