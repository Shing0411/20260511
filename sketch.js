let video;
let hands;

let handLandmarks = null;
let detectedGesture = "none";

// 相機狀態
let cameraStatus = "正在啟動攝影機...";
let cameraReady = false;
let cameraError = "";

// 遊戲狀態
let gameState = "playing";
// playing：遊戲中
// menu：遊戲結束選單
// ended：遊戲結束

let playerMove = "等待手勢";
let computerMove = "等待中";
let resultText = "請出拳：石頭、剪刀、布";
let scoreText = "請先完成一局遊戲";

let playerScore = 0;
let computerScore = 0;
let round = 1;
const maxRound = 3;

// 避免同一個手勢連續觸發
let lastGameGesture = "none";
let lastGameGestureTime = 0;
const gameGestureCooldown = 1800;

// 選單手勢確認
const GESTURE_CONFIRM_TIME = 2000;
let currentMenuGesture = "none";
let gestureStartTime = null;
let gestureProgress = 0;
let menuStatus = "請做出手勢選擇";
let gestureTriggered = false;

// 防止 MediaPipe 重複處理影像
let isSendingFrame = false;

function setup() {
  const canvasW = min(windowWidth * 0.94, 980);
  const canvasH = min(windowHeight * 0.9, 680);

  const canvas = createCanvas(canvasW, canvasH);

  // 如果 index.html 有 <main id="app"></main>，就把 canvas 放進去
  const app = document.getElementById("app");
  if (app) {
    canvas.parent("app");
  }

  // 使用 p5.js 內建攝影機，這是你以前成功開啟鏡頭的方式
  video = createCapture(
    {
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    },
    function () {
      cameraReady = true;
      cameraStatus = "攝影機啟動成功";
      cameraError = "";
      console.log("p5 攝影機啟動成功");
    }
  );

  video.size(640, 480);
  video.hide();

  setupMediaPipeHands();
  requestAnimationFrame(sendFrameToMediaPipe);
}

function draw() {
  background(2, 6, 23);

  drawMainPanel();
  drawCameraView();
  drawGameInfo();
  drawGestureGuide();

  if (gameState === "menu") {
    drawMenuPanel();
  }

  if (gameState === "ended") {
    drawEndedPanel();
  }
}

function windowResized() {
  const canvasW = min(windowWidth * 0.94, 980);
  const canvasH = min(windowHeight * 0.9, 680);
  resizeCanvas(canvasW, canvasH);
}

// =====================================================
// MediaPipe Hands 設定
// =====================================================

function setupMediaPipeHands() {
  hands = new Hands({
    locateFile: function (file) {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65
  });

  hands.onResults(onHandsResults);
}

async function sendFrameToMediaPipe() {
  if (
    video &&
    video.elt &&
    video.elt.readyState >= 2 &&
    hands &&
    !isSendingFrame
  ) {
    try {
      isSendingFrame = true;
      await hands.send({ image: video.elt });
    } catch (error) {
      console.error("MediaPipe 影像送出失敗：", error);
      cameraError = "MediaPipe 影像處理失敗";
    } finally {
      isSendingFrame = false;
    }
  }

  requestAnimationFrame(sendFrameToMediaPipe);
}

function onHandsResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    handLandmarks = results.multiHandLandmarks[0];
    detectedGesture = detectGesture(handLandmarks);

    if (gameState === "playing") {
      handlePlayingGesture(detectedGesture);
    } else if (gameState === "menu") {
      handleMenuGesture(handLandmarks);
    }
  } else {
    handLandmarks = null;
    detectedGesture = "none";

    if (gameState === "menu") {
      resetMenuGestureOnly();
    }
  }
}

// =====================================================
// 手勢辨識核心
// =====================================================

function isFingerExtended(landmarks, tip, pip) {
  return landmarks[tip].y < landmarks[pip].y;
}

function detectGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return "none";
  }

  const indexUp = isFingerExtended(landmarks, 8, 6);
  const middleUp = isFingerExtended(landmarks, 12, 10);
  const ringUp = isFingerExtended(landmarks, 16, 14);
  const pinkyUp = isFingerExtended(landmarks, 20, 18);

  const extendedCount = [
    indexUp,
    middleUp,
    ringUp,
    pinkyUp
  ].filter(Boolean).length;

  // 石頭：四根手指都彎曲
  if (extendedCount === 0) {
    return "rock";
  }

  // 剪刀：食指、中指伸直；無名指、小指彎曲
  if (indexUp && middleUp && !ringUp && !pinkyUp) {
    return "scissors";
  }

  // 布：四根手指都伸直
  if (extendedCount >= 4) {
    return "paper";
  }

  return "unknown";
}

function gestureToChinese(gesture) {
  if (gesture === "rock") return "石頭 ✊";
  if (gesture === "scissors") return "剪刀 ✌️";
  if (gesture === "paper") return "布 ✋";
  if (gesture === "unknown") return "手勢不明確";
  return "尚未偵測";
}

// =====================================================
// 遊戲邏輯
// =====================================================

function handlePlayingGesture(gesture) {
  if (gesture !== "rock" && gesture !== "scissors" && gesture !== "paper") {
    return;
  }

  const now = millis();

  if (
    gesture === lastGameGesture &&
    now - lastGameGestureTime < gameGestureCooldown
  ) {
    return;
  }

  lastGameGesture = gesture;
  lastGameGestureTime = now;

  playRound(gesture);
}

function playRound(playerGesture) {
  const choices = ["rock", "scissors", "paper"];
  const computerGesture = random(choices);

  playerMove = gestureToChinese(playerGesture);
  computerMove = gestureToChinese(computerGesture);

  const winner = getWinner(playerGesture, computerGesture);

  if (winner === "player") {
    playerScore++;
    resultText = "你贏了這一回合！AI 被你打敗了 🎉";
  } else if (winner === "computer") {
    computerScore++;
    resultText = "電腦贏了這一回合，再試一次 💪";
  } else {
    resultText = "平手！你們太有默契了 🤝";
  }

  scoreText = `第 ${round} / ${maxRound} 回合｜你 ${playerScore}：${computerScore} 電腦`;

  if (round >= maxRound) {
    setTimeout(function () {
      enterMenuState();
    }, 650);
  } else {
    round++;
  }
}

function getWinner(player, computer) {
  if (player === computer) return "draw";

  if (
    (player === "rock" && computer === "scissors") ||
    (player === "scissors" && computer === "paper") ||
    (player === "paper" && computer === "rock")
  ) {
    return "player";
  }

  return "computer";
}

function enterMenuState() {
  gameState = "menu";

  if (playerScore > computerScore) {
    resultText = "三回合結束：你獲得勝利！太強了 👑";
  } else if (playerScore < computerScore) {
    resultText = "三回合結束：電腦獲勝！下次一定可以贏 🔥";
  } else {
    resultText = "三回合結束：平手！勢均力敵 ⚖️";
  }

  menuStatus = "請選擇：張開手掌繼續，握拳結束";
  resetMenuGestureOnly();
}

// =====================================================
// 遊戲結束選單手勢
// =====================================================

function handleMenuGesture(landmarks) {
  const gesture = detectGesture(landmarks);

  let menuGesture = "none";

  if (gesture === "paper") {
    menuGesture = "continue";
  } else if (gesture === "rock") {
    menuGesture = "exit";
  }

  const now = millis();

  if (menuGesture === "none") {
    resetMenuGestureOnly();
    menuStatus = "請做出明確手勢：✋繼續 或 ✊結束";
    return;
  }

  if (menuGesture !== currentMenuGesture) {
    currentMenuGesture = menuGesture;
    gestureStartTime = now;
    gestureProgress = 0;
    gestureTriggered = false;

    if (menuGesture === "continue") {
      menuStatus = "偵測到張開手掌，請保持 2 秒";
    } else if (menuGesture === "exit") {
      menuStatus = "偵測到握拳，請保持 2 秒";
    }

    return;
  }

  const elapsed = now - gestureStartTime;
  gestureProgress = constrain(elapsed / GESTURE_CONFIRM_TIME, 0, 1);

  if (elapsed >= GESTURE_CONFIRM_TIME && !gestureTriggered) {
    gestureTriggered = true;

    if (menuGesture === "continue") {
      menuStatus = "確認成功：繼續遊戲！";

      setTimeout(function () {
        restartGame();
      }, 500);
    } else if (menuGesture === "exit") {
      menuStatus = "確認成功：結束遊戲！";

      setTimeout(function () {
        endGame();
      }, 500);
    }
  }
}

function resetMenuGestureOnly() {
  currentMenuGesture = "none";
  gestureStartTime = null;
  gestureProgress = 0;
  gestureTriggered = false;
}

function restartGame() {
  gameState = "playing";
  playerMove = "等待手勢";
  computerMove = "等待中";
  resultText = "新的一局開始！請出拳：石頭、剪刀、布";
  scoreText = "請先完成一局遊戲";
  playerScore = 0;
  computerScore = 0;
  round = 1;
  lastGameGesture = "none";
  lastGameGestureTime = 0;
  resetMenuGestureOnly();
}

function endGame() {
  gameState = "ended";
  resultText = "遊戲已結束，感謝遊玩！";
  scoreText = "你已完成 AI 手勢辨識互動體驗";
  resetMenuGestureOnly();
}

// =====================================================
// RWD 版面
// =====================================================

function getLayout() {
  const isSmall = width < 760;

  if (!isSmall) {
    return {
      camX: 36,
      camY: 125,
      camW: width * 0.48,
      camH: height * 0.48,
      infoX: width * 0.55,
      infoY: 125,
      infoW: width * 0.38,
      infoH: height * 0.48,
      guideX: 36,
      guideY: height - 145,
      guideW: width - 72,
      guideH: 105
    };
  }

  return {
    camX: 30,
    camY: 110,
    camW: width - 60,
    camH: height * 0.34,
    infoX: 30,
    infoY: 110 + height * 0.34 + 58,
    infoW: width - 60,
    infoH: height * 0.24,
    guideX: 30,
    guideY: height - 128,
    guideW: width - 60,
    guideH: 96
  };
}

// =====================================================
// 畫面繪製
// =====================================================

function drawMainPanel() {
  noStroke();

  fill(15, 23, 42, 245);
  rect(0, 0, width, height, 28);

  fill(30, 41, 59, 220);
  rect(22, 22, width - 44, height - 44, 26);

  fill(56, 189, 248, 32);
  circle(width - 90, 90, 180);

  fill(168, 85, 247, 28);
  circle(95, height - 75, 190);

  fill(34, 197, 94, 18);
  circle(width * 0.5, height + 20, 260);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(min(width * 0.04, 34));
  textStyle(BOLD);
  text("AI 手勢魔法猜拳遊戲", width / 2, 56);

  textStyle(NORMAL);
  textSize(min(width * 0.018, 16));
  fill(203, 213, 225);
  text("使用手勢與 AI 互動，學習 MediaPipe 手部辨識原理", width / 2, 88);
}

function drawCameraView() {
  const layout = getLayout();

  const camX = layout.camX;
  const camY = layout.camY;
  const camW = layout.camW;
  const camH = layout.camH;

  noStroke();
  fill(2, 6, 23, 150);
  rect(camX - 8, camY - 8, camW + 16, camH + 46, 28);

  push();
  translate(camX + camW, camY);
  scale(-1, 1);

  if (video && video.elt && video.elt.readyState >= 2) {
    image(video, 0, 0, camW, camH);
  } else {
    fill(15, 23, 42);
    rect(0, 0, camW, camH, 24);

    push();
    scale(-1, 1);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(15);
    text(cameraStatus, -camW / 2, camH / 2 - 10);

    if (cameraError) {
      fill(250, 204, 21);
      textSize(13);
      text(cameraError, -camW / 2, camH / 2 + 18);
    }
    pop();
  }

  pop();

  noFill();
  stroke(cameraReady ? color(34, 211, 238, 210) : color(250, 204, 21, 210));
  strokeWeight(3);
  rect(camX, camY, camW, camH, 24);

  noStroke();
  fill(cameraReady ? color(14, 165, 233) : color(234, 179, 8));
  rect(camX + 18, camY + 16, 112, 30, 999);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);
  textStyle(BOLD);
  text(cameraReady ? "LIVE CAMERA" : "CAMERA", camX + 74, camY + 31);

  drawHandPoints(camX, camY, camW, camH);

  noStroke();
  fill(cameraReady ? color(34, 197, 94) : color(250, 204, 21));
  textAlign(LEFT, CENTER);
  textSize(13);
  textStyle(NORMAL);
  text(cameraStatus, camX + 12, camY + camH + 24);
}

function drawHandPoints(camX, camY, camW, camH) {
  if (!handLandmarks) return;

  push();

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
  ];

  stroke(34, 211, 238, 180);
  strokeWeight(2);

  for (let i = 0; i < connections.length; i++) {
    const a = handLandmarks[connections[i][0]];
    const b = handLandmarks[connections[i][1]];

    const ax = camX + (1 - a.x) * camW;
    const ay = camY + a.y * camH;
    const bx = camX + (1 - b.x) * camW;
    const by = camY + b.y * camH;

    line(ax, ay, bx, by);
  }

  for (let i = 0; i < handLandmarks.length; i++) {
    const lm = handLandmarks[i];

    const x = camX + (1 - lm.x) * camW;
    const y = camY + lm.y * camH;

    noStroke();

    if ([4, 8, 12, 16, 20].includes(i)) {
      fill(250, 204, 21);
      circle(x, y, 11);
    } else {
      fill(255);
      circle(x, y, 6);
    }
  }

  pop();
}

function drawGameInfo() {
  const layout = getLayout();

  const infoX = layout.infoX;
  const infoY = layout.infoY;
  const infoW = layout.infoW;
  const infoH = layout.infoH;

  noStroke();
  fill(2, 6, 23, 165);
  rect(infoX - 8, infoY - 8, infoW + 16, infoH + 16, 28);

  fill(15, 23, 42, 220);
  rect(infoX, infoY, infoW, infoH, 24);

  fill(99, 102, 241);
  rect(infoX + 22, infoY + 18, 92, 30, 999);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);
  textStyle(BOLD);
  text("GAME INFO", infoX + 68, infoY + 33);

  fill(255);
  textAlign(LEFT, TOP);
  textSize(width < 760 ? 18 : 22);
  textStyle(BOLD);
  text("遊戲資訊", infoX + 24, infoY + 62);

  textStyle(NORMAL);
  textSize(width < 760 ? 13 : 16);
  fill(226, 232, 240);

  text(`目前狀態：${getGameStateText()}`, infoX + 24, infoY + 100);
  text(`你出：${playerMove}`, infoX + 24, infoY + 130);
  text(`電腦：${computerMove}`, infoX + 24, infoY + 160);

  fill(250, 204, 21);
  textSize(width < 760 ? 13 : 17);
  text(resultText, infoX + 24, infoY + 195, infoW - 48, 70);

  const scoreY = infoY + infoH - 45;

  fill(8, 47, 73, 220);
  rect(infoX + 22, scoreY, infoW - 44, 32, 999);

  fill(125, 211, 252);
  textAlign(CENTER, CENTER);
  textSize(width < 760 ? 12 : 15);
  textStyle(BOLD);
  text(scoreText, infoX + infoW / 2, scoreY + 16);
}

function drawGestureGuide() {
  const layout = getLayout();

  const x = layout.guideX;
  const y = layout.guideY;
  const w = layout.guideW;
  const h = layout.guideH;

  noStroke();
  fill(2, 6, 23, 145);
  rect(x - 6, y - 6, w + 12, h + 12, 28);

  fill(51, 65, 85, 220);
  rect(x, y, w, h, 22);

  fill(255);
  textAlign(LEFT, TOP);
  textSize(width < 760 ? 15 : 18);
  textStyle(BOLD);
  text("手勢操作說明", x + 24, y + 16);

  textStyle(NORMAL);
  textSize(width < 760 ? 12 : 15);
  fill(226, 232, 240);

  if (gameState === "playing") {
    text("遊戲中請出拳：✊ 石頭　✌️ 剪刀　✋ 布", x + 24, y + 48);
    text(`目前 AI 偵測：${gestureToChinese(detectedGesture)}`, x + 24, y + 73);
  } else if (gameState === "menu") {
    text("結束選單：✋ 張開手掌 2 秒＝繼續　✊ 握拳 2 秒＝結束", x + 24, y + 48);
    text(`目前選單狀態：${menuStatus}`, x + 24, y + 73);
  } else {
    text("遊戲已結束，重新整理網頁可以再次開始。", x + 24, y + 56);
  }
}

function drawMenuPanel() {
  const x = width * 0.15;
  const y = height * 0.24;
  const w = width * 0.7;
  const h = height * 0.36;

  noStroke();
  fill(0, 0, 0, 175);
  rect(0, 0, width, height, 28);

  fill(248, 250, 252);
  rect(x, y, w, h, 28);

  fill(15, 23, 42);
  textAlign(CENTER, TOP);
  textSize(min(width * 0.035, 30));
  textStyle(BOLD);
  text("遊戲結束選單", width / 2, y + 28);

  textStyle(NORMAL);
  textSize(min(width * 0.022, 18));
  fill(51, 65, 85);
  text("請使用 AI 手勢選擇下一步", width / 2, y + 78);

  textSize(min(width * 0.024, 21));
  fill(22, 101, 52);
  text("✋ 張開手掌 2 秒：繼續遊戲", width / 2, y + 122);

  fill(153, 27, 27);
  text("✊ 握拳 2 秒：結束遊戲", width / 2, y + 158);

  drawProgressBar(x + w * 0.16, y + h - 54, w * 0.68, 24);
}

function drawProgressBar(x, y, w, h) {
  noStroke();
  fill(226, 232, 240);
  rect(x, y, w, h, 999);

  if (currentMenuGesture === "continue") {
    fill(34, 197, 94);
  } else if (currentMenuGesture === "exit") {
    fill(239, 68, 68);
  } else {
    fill(148, 163, 184);
  }

  rect(x, y, w * gestureProgress, h, 999);

  fill(15, 23, 42);
  textAlign(CENTER, CENTER);
  textSize(13);
  textStyle(BOLD);
  text(`${Math.floor(gestureProgress * 100)}%`, x + w / 2, y + h / 2);
}

function drawEndedPanel() {
  const x = width * 0.18;
  const y = height * 0.28;
  const w = width * 0.64;
  const h = height * 0.3;

  noStroke();
  fill(0, 0, 0, 185);
  rect(0, 0, width, height, 28);

  fill(248, 250, 252);
  rect(x, y, w, h, 28);

  fill(15, 23, 42);
  textAlign(CENTER, CENTER);
  textSize(min(width * 0.04, 34));
  textStyle(BOLD);
  text("感謝遊玩！", width / 2, y + h * 0.32);

  textStyle(NORMAL);
  textSize(min(width * 0.023, 19));
  fill(71, 85, 105);
  text("你已完成 AI 手勢辨識互動體驗", width / 2, y + h * 0.58);

  textSize(min(width * 0.018, 15));
  fill(100, 116, 139);
  text("若要重新開始，請重新整理網頁", width / 2, y + h * 0.78);
}

function getGameStateText() {
  if (gameState === "playing") return "遊戲進行中";
  if (gameState === "menu") return "等待選單手勢";
  if (gameState === "ended") return "遊戲已結束";
  return "未知";
}