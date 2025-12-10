// Rename the physics namespace for convenience
const CANNON = window.CANNON;

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x7c94b8); // Sky color
document.body.appendChild(renderer.domElement);

// --- CANNON.JS (PHYSICS) SETUP ---
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
});
world.defaultContactMaterial.friction = 0.5;
world.defaultContactMaterial.restitution = 0.5;

// --- GAME OBJECTS & ARRAYS ---
let ballMesh, ballBody;
let pinMeshes = [];
let pinBodies = [];
const LANE_LENGTH = 50;

// --- MATERIALS ---
const laneMaterial = new THREE.MeshPhongMaterial({ color: 0x664422 });
const ballMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const pinMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

// --- GEOMETRIES ---
const ballGeometry = new THREE.SphereGeometry(1, 32, 32);
const pinGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 16);

// --- SCENE LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(10, 15, 10);
scene.add(directionalLight);

// --- UI ELEMENTS ---
const scoreElement = document.getElementById('score');
const pinsStandingElement = document.getElementById('pinsStanding');
let score = 0;
let pinsStanding = 10;
let isRolling = false;
let gameStatus = "ready";

// --- 1. CREATE LANE AND WALLS (Same as before) ---
function createLane() {
    const laneMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, LANE_LENGTH), laneMaterial);
    laneMesh.position.set(0, -0.25, LANE_LENGTH / 2 - 5);
    scene.add(laneMesh);
    const laneShape = new CANNON.Box(new CANNON.Vec3(5, 0.25, LANE_LENGTH / 2));
    const laneBody = new CANNON.Body({ mass: 0, shape: laneShape, position: new CANNON.Vec3(0, -0.25, LANE_LENGTH / 2 - 5) });
    world.addBody(laneBody);
    
    // Side Walls (Gutters/Bumpers - simplified)
    const wallShape = new CANNON.Box(new CANNON.Vec3(0.5, 1, LANE_LENGTH / 2));
    const wallMeshMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const leftWallBody = new CANNON.Body({ mass: 0, shape: wallShape, position: new CANNON.Vec3(-5.25, 0.5, LANE_LENGTH / 2 - 5) });
    world.addBody(leftWallBody);
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, LANE_LENGTH), wallMeshMaterial));
    const rightWallBody = new CANNON.Body({ mass: 0, shape: wallShape, position: new CANNON.Vec3(5.25, 0.5, LANE_LENGTH / 2 - 5) });
    world.addBody(rightWallBody);
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, LANE_LENGTH), wallMeshMaterial));
}

// --- 2. CREATE BALL AND PINS (Same as before) ---
function createBall() {
    ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    ballMesh.position.set(0, 1, LANE_LENGTH - 5);
    scene.add(ballMesh);
    const ballShape = new CANNON.Sphere(1);
    ballBody = new CANNON.Body({ mass: 5, shape: ballShape, position: new CANNON.Vec3(0, 1, LANE_LENGTH - 5) });
    world.addBody(ballBody);
}

function createPins() {
    const pinPositions = [
        { x: 0, z: 0 }, { x: -0.5, z: -1 }, { x: 0.5, z: -1 }, 
        { x: -1, z: -2 }, { x: 0, z: -2 }, { x: 1, z: -2 }, 
        { x: -1.5, z: -3 }, { x: -0.5, z: -3 }, { x: 0.5, z: -3 }, { x: 1.5, z: -3 }
    ];

    pinMeshes = [];
    pinBodies = [];

    pinPositions.forEach((pos) => {
        const mesh = new THREE.Mesh(pinGeometry, pinMaterial);
        mesh.position.set(pos.x, 1.5, LANE_LENGTH - 40 + pos.z * 1.5);
        scene.add(mesh);
        pinMeshes.push(mesh);
        
        const shape = new CANNON.Cylinder(0.3, 0.5, 3, 16);
        const body = new CANNON.Body({ mass: 1, shape: shape, position: new CANNON.Vec3(pos.x, 1.5, LANE_LENGTH - 40 + pos.z * 1.5) });
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        world.addBody(body);
        pinBodies.push(body);
    });
}

// --- 3. GAME LOGIC (Simplified) ---

function checkPins() {
    let count = 0;
    pinBodies.forEach(body => {
        // Count pin as standing if it hasn't tilted too much AND hasn't fallen below the lane
        const tiltThreshold = 0.5; 
        if (body.position.y > 0 && Math.abs(body.quaternion.x) < tiltThreshold && Math.abs(body.quaternion.z) < tiltThreshold) {
             count++;
        }
    });
    
    // Update score
    const knockedDown = pinsStanding - count;
    if (knockedDown > 0) {
        score += knockedDown;
        pinsStanding -= knockedDown;
    }
    
    pinsStandingElement.textContent = pinsStanding;
    scoreElement.textContent = score;

    if (pinsStanding === 0) {
        document.getElementById('info').querySelector('h1').textContent = "STRIKE! 🎳";
    }
}

function resetGame() {
    pinBodies.forEach(body => world.removeBody(body));
    pinMeshes.forEach(mesh => scene.remove(mesh));
    world.removeBody(ballBody);
    scene.remove(ballMesh);
    
    isRolling = false;
    pinsStanding = 10;
    
    createBall();
    createPins();
    
    document.getElementById('info').querySelector('h1').textContent = "3D Bowling 🎳";
    pinsStandingElement.textContent = 10;
    gameStatus = "ready";
}

function rollBall(event) {
    if (isRolling || gameStatus !== "ready") return;

    isRolling = true;
    gameStatus = "rolling";
    
    // Use the clientX of the tap to determine the side force
    let clientX = event.clientX || event.touches[0].clientX;
    const canvasCenterX = window.innerWidth / 2;
    
    // Horizontal force based on tap position (-1 at far left, 1 at far right)
    const normalizedX = (clientX - canvasCenterX) / canvasCenterX; 
    const forceX = normalizedX * 25; // Increased force for better mobile response
    const forceZ = -120; // Stronger forward push

    // Apply impulse
    ballBody.applyImpulse(
        new CANNON.Vec3(forceX, 0, forceZ), 
        ballBody.position
    );

    document.getElementById('info').querySelector('h1').textContent = "Rolling...";

    // Check pins after a delay
    setTimeout(() => {
        checkPins();
        setTimeout(resetGame, 4000); // Wait 4 seconds for reset
    }, 3000); 
}

// --- 4. TOUCH CAMERA CONTROLS (Mobile Specific) ---
let isDragging = false;
let previousX = 0;
let previousY = 0;
let angle = 0;
let heightOffset = 0;

renderer.domElement.addEventListener('touchstart', (e) => {
    // Only allow camera control if the game is ready for a roll
    if (gameStatus === "ready") {
        isDragging = true;
        previousX = e.touches[0].clientX;
        previousY = e.touches[0].clientY;
    }
});

renderer.domElement.addEventListener('touchend', () => {
    isDragging = false;
});

renderer.domElement.addEventListener('touchmove', (e) => {
    if (!isDragging || gameStatus !== "ready") return;
    
    e.preventDefault(); // Stop mobile scrolling while dragging camera
    
    const deltaX = e.touches[0].clientX - previousX;
    const deltaY = e.touches[0].clientY - previousY;
    
    // Horizontal swipe rotates the camera around the scene
    angle -= deltaX * 0.005;
    
    // Vertical swipe moves the camera up/down
    heightOffset += deltaY * 0.02; // Slower vertical movement
    heightOffset = Math.max(-5, Math.min(10, heightOffset)); // Limit vertical movement
    
    previousX = e.touches[0].clientX;
    previousY = e.touches[0].clientY;
});


// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    // Step the physics world
    world.fixedStep();

    // Copy positions and rotations from Cannon.js bodies to Three.js meshes
    if (ballMesh) {
        ballMesh.position.copy(ballBody.position);
        ballMesh.quaternion.copy(ballBody.quaternion);
    }

    pinBodies.forEach((body, index) => {
        pinMeshes[index].position.copy(body.position);
        pinMeshes[index].quaternion.copy(body.quaternion);
    });

    // Update Camera position based on orbital angle and height offset
    const radius = 20; // Fixed distance from the center
    camera.position.x = Math.sin(angle) * radius;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = 15 + heightOffset; // Default height + offset

    camera.lookAt(new THREE.Vector3(0, 5, 0)); // Always look towards the pin area

    renderer.render(scene, camera);
}

// --- INITIALIZATION ---
createLane();
createBall();
createPins();

// Set initial camera position
camera.position.set(0, 15, 20);

// Start the game loop
animate();
