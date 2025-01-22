const MODEL_URL = '/models'; // Update this path to the correct location of your models

let labeledFaceDescriptors = [];

// Load models and start video
async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  console.log('Models loaded successfully');
  
  // Load the database of known faces
  await loadLabeledImages();
  startVideo();
}

// Load known faces
async function loadLabeledImages() {
  const labels = ['person1', 'person', 'person2', 'person3', 'person4'];  // Add labels for known people
  for (let label of labels) {
    const descriptions = [];  // Store face descriptors for the labeled person
    try {
      // Load image for person1
      const img = await faceapi.fetchImage(`imgs/${label}.jpg`); // Replace with the actual image path
      const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
      console.log(detections);

      
      if (detections.length === 0) {
        console.error(`No face detected in image for ${label}`);
        continue;  // Skip this label if no face is detected
      }

      descriptions.push(detections[0].descriptor); // Get the descriptor for the face
      labeledFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(label, descriptions));
    } catch (err) {
      console.error(`Error processing image for ${label}:`, err);
    }
  }
  console.log('Labeled images loaded');
}

// Start video stream and detect faces
let canvas;

// Start video stream and detect faces
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
  }, 1000)
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
for (let i=0; dect.length > i;i++){
  console.log(`${dect[i].label}`)
  if(dect[i].label === 'undefined'){
    //exit
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
