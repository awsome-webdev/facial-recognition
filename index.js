const MODEL_URL = '/models'; // Update this path to the correct location of your models

let labeledFaceDescriptors = [];
let uploadCounter = 1; // Initialize the upload counter

// Load models and start video
async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  console.log('Models loaded successfully');
  
  // Wait for images to be uploaded before starting the video
  await waitForImageUploads();
  startVideo();
}

// Wait for image uploads to be completed
async function waitForImageUploads() {
  return new Promise(resolve => {
    document.getElementById('Upload').addEventListener('click', resolve);
  });
}

// Handle image upload
document.querySelectorAll('.imageUpload').forEach(input => {
  input.addEventListener('change', handleImageUpload);
});

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  // Create an image element to display the uploaded image
  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    // Dynamically create a label for the uploaded image (e.g., upload1, upload2, etc.)
    const label = `upload${uploadCounter}`;
    uploadCounter++; // Increment the counter for the next upload

    // Perform face detection and recognition for the uploaded image
    const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
    if (detections.length === 0) {
      console.log('No faces detected in the uploaded image');
      return;
    }

    // Add the uploaded image's face descriptor to the labeled face descriptors
    const descriptions = detections.map(d => d.descriptor);
    labeledFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(label, descriptions));

    // Log results (match the uploaded face with known faces)
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));

    results.forEach((bestMatch, i) => {
      console.log(`Uploaded face ${label} matched with: ${bestMatch.label} with confidence: ${(1 - bestMatch.distance).toFixed(2)}`);
    });
  };
}

// Start video stream and detect faces
let canvas;

function startVideo() {
  const video = document.getElementById('video');
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        
        // Create a canvas to draw on top of the video
        canvas = faceapi.createCanvasFromMedia(video);
        document.body.append(canvas); // Append the canvas to the DOM (or use a specific container)
        const displaySize = { width: video.width, height: video.height };
        //faceapi.matchDimensions(canvas, displaySize);
        setTimeout(function(){
          const canvas = document.getElementsByTagName('canvas')[0]
          canvas.setAttribute('width', document.getElementsByTagName('video')[0].width)
          canvas.setAttribute('height', document.getElementsByTagName('video')[0].height)
        }, 1000)
      };
    })
    .catch(err => console.error('Error accessing webcam:', err));

  // Detect faces and recognize people
  setInterval(function(){
    detectAndRecognizeFaces(video);
  }, 50)
}

// Detect faces and match them with known faces
async function detectAndRecognizeFaces(video) {
  const detections = await faceapi.detectAllFaces(video)
    .withFaceLandmarks()
    .withFaceDescriptors();

  // Check if any faces are detected
  if (detections.length === 0) {
    console.log('No faces detected in video feed');
    return;
  }

  // Create a face matcher
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6); // 0.6 is the threshold for face matching

  // Get results by matching each detected face descriptor
  const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor));

  // Collect all detections in an array
  const dect = results.map((bestMatch, i) => {
    return {
      label: bestMatch.label,
      confidence: bestMatch.distance,
      box: detections[i].detection.box,
    };
  });

  // Log the array of detected faces
  for (let i = 0; dect.length > i; i++) {
    console.log(`${dect[i].label} con: ${dect[i].confidence}`);
    if (dect[i].label === 'unknown' && dect[i].confidence > 0.7) {
      const pro = document.getElementById('false')
      pro.value = dect[i].confidence
      const pro2 = document.getElementById('true')
      pro2.value = 0
    }
    else if (dect[i].label != '') {
      const pro = document.getElementById('true')
      pro.value = dect[i].confidence
      const pro2 = document.getElementById('false')
      pro2.value = 0
    }
  }

  // Update the canvas with the face detection boxes
  const resizedDetections = faceapi.resizeResults(detections, { width: 680, height: 480 });
  const ctx = canvas?.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
  }

  // Draw boxes and labels for all detections
  dect.forEach(face => {
    const { box, label, confidence } = face;
    new faceapi.draw.DrawBox(box, { label: `${label} (${(1 - confidence).toFixed(2)})` }).draw(canvas);
  });
}

loadModels();  // Start loading models
