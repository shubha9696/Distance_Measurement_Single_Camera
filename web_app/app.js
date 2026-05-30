const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const distanceDisplay = document.getElementById('distance-val');
const focalLengthDisplay = document.getElementById('focal-length-val');
const fpsDisplay = document.getElementById('fps-val');
const calibrateBtn = document.getElementById('calibrate-btn');

const knownWidthInput = document.getElementById('known-width');
const knownDistInput = document.getElementById('known-dist');

let focalLength = 800; // Initial estimate
let lastTime = 0;
let frameCount = 0;

function onResults(results) {
    // Update FPS
    const now = performance.now();
    frameCount++;
    if (now - lastTime >= 1000) {
        fpsDisplay.innerText = frameCount;
        frameCount = 0;
        lastTime = now;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // We don't draw the video on canvas because the video element is behind it
    // But we draw the face mesh landmarks and distance info
    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            // Landmark 33: Left eye outer corner
            // Landmark 263: Right eye outer corner
            const p1 = landmarks[33];
            const p2 = landmarks[263];

            // Calculate pixel width (Euclidean distance in pixel space)
            const dx = (p2.x - p1.x) * canvasElement.width;
            const dy = (p2.y - p1.y) * canvasElement.height;
            const pixelWidth = Math.sqrt(dx*dx + dy*dy);

            // Estimate Distance
            const knownWidth = parseFloat(knownWidthInput.value);
            const distance = (knownWidth * focalLength) / pixelWidth;
            
            distanceDisplay.innerText = distance.toFixed(1);

            // Draw futuristic UI on face
            drawFaceHUD(landmarks, distance);
        }
    }
    canvasCtx.restore();
}

function drawFaceHUD(landmarks, distance) {
    // Draw glowing points for eyes
    const eyeL = landmarks[33];
    const eyeR = landmarks[263];

    canvasCtx.fillStyle = '#00f3ff';
    canvasCtx.shadowBlur = 10;
    canvasCtx.shadowColor = '#00f3ff';
    
    canvasCtx.beginPath();
    canvasCtx.arc(eyeL.x * canvasElement.width, eyeL.y * canvasElement.height, 4, 0, 2 * Math.PI);
    canvasCtx.arc(eyeR.x * canvasElement.width, eyeR.y * canvasElement.height, 4, 0, 2 * Math.PI);
    canvasCtx.fill();

    // Draw connection line
    canvasCtx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(eyeL.x * canvasElement.width, eyeL.y * canvasElement.height);
    canvasCtx.lineTo(eyeR.x * canvasElement.width, eyeR.y * canvasElement.height);
    canvasCtx.stroke();
}

const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
});

faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({image: videoElement});
    },
    width: 1280,
    height: 720
});

camera.start();

// Handle resizing
window.addEventListener('resize', () => {
    canvasElement.width = videoElement.clientWidth;
    canvasElement.height = videoElement.clientHeight;
});
// Initial set
setTimeout(() => {
    canvasElement.width = videoElement.clientWidth;
    canvasElement.height = videoElement.clientHeight;
}, 1000);

calibrateBtn.addEventListener('click', () => {
    // Calibrate focal length based on current face in frame
    // We need the pixel width of the face right now
    // Since we don't have a direct "get current results" we wait for the next frame or use a global var
    // For simplicity, we'll use a hacky way to get the last pixelWidth
    
    // In a real app, we'd capture the frame. Here we'll just alert the user or use a flag.
    const currentPixelWidth = parseFloat(distanceDisplay.dataset.lastPixelWidth || 0);
    if (currentPixelWidth > 0) {
        const d = parseFloat(knownDistInput.value);
        const w = parseFloat(knownWidthInput.value);
        focalLength = (currentPixelWidth * d) / w;
        focalLengthDisplay.innerText = Math.round(focalLength);
        alert(`Calibrated! New Focal Length: ${Math.round(focalLength)}`);
    } else {
        alert("Face not detected. Please position yourself in front of the camera.");
    }
});

// Update the hacky pixel width tracker
faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const p1 = landmarks[33];
        const p2 = landmarks[263];
        const dx = (p2.x - p1.x) * canvasElement.width;
        const dy = (p2.y - p1.y) * canvasElement.height;
        const pixelWidth = Math.sqrt(dx*dx + dy*dy);
        distanceDisplay.dataset.lastPixelWidth = pixelWidth;
    }
    onResults(results);
});
