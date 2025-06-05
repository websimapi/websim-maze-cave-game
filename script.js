document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const messageEl = document.getElementById('message');
    const viewToggle = document.getElementById('viewToggle');

    const CELL_SIZE = 25;
    const MAZE_COLS = 24; // Adjusted for typical screen widths
    const MAZE_ROWS = 16; // Adjusted for typical screen heights

    canvas.width = MAZE_COLS * CELL_SIZE;
    canvas.height = MAZE_ROWS * CELL_SIZE;

    const WALL_COLOR = '#504A4B'; // Dark rock
    const PLAYER_COLOR = '#FFD700'; // Gold (like a torch)
    const START_COLOR = '#32CD32'; // Lime Green
    const END_COLOR = '#DC143C';   // Crimson Red

    let maze;
    let player;
    let startPos;
    let endPos;
    let gameOver = false;

    // --- Audio Handling ---
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const soundBuffers = {};

    async function loadSound(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            soundBuffers[name] = await audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error(`Error loading sound ${name}:`, error);
        }
    }

    function playSound(name) {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        if (soundBuffers[name]) {
            const source = audioContext.createBufferSource();
            source.buffer = soundBuffers[name];
            source.connect(audioContext.destination);
            source.start(0);
        }
    }

    // --- Maze Generation (Recursive Backtracking) ---
    function createGrid(rows, cols) {
        const grid = [];
        for (let r = 0; r < rows; r++) {
            grid[r] = [];
            for (let c = 0; c < cols; c++) {
                grid[r][c] = {
                    r, c,
                    walls: { top: true, right: true, bottom: true, left: true },
                    visited: false
                };
            }
        }
        return grid;
    }

    function generateMaze(rows, cols) {
        const grid = createGrid(rows, cols);
        const stack = [];
        let currentCell = grid[0][0];
        currentCell.visited = true;
        stack.push(currentCell);

        while (stack.length > 0) {
            currentCell = stack[stack.length - 1];
            const { r, c } = currentCell;
            const neighbors = [];

            // Check top
            if (r > 0 && !grid[r - 1][c].visited) neighbors.push(grid[r - 1][c]);
            // Check right
            if (c < cols - 1 && !grid[r][c + 1].visited) neighbors.push(grid[r][c + 1]);
            // Check bottom
            if (r < rows - 1 && !grid[r + 1][c].visited) neighbors.push(grid[r + 1][c]);
            // Check left
            if (c > 0 && !grid[r][c - 1].visited) neighbors.push(grid[r][c - 1]);

            if (neighbors.length > 0) {
                const nextCell = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                // Remove walls
                if (nextCell.r < r) { // Top neighbor
                    currentCell.walls.top = false;
                    nextCell.walls.bottom = false;
                } else if (nextCell.c > c) { // Right neighbor
                    currentCell.walls.right = false;
                    nextCell.walls.left = false;
                } else if (nextCell.r > r) { // Bottom neighbor
                    currentCell.walls.bottom = false;
                    nextCell.walls.top = false;
                } else if (nextCell.c < c) { // Left neighbor
                    currentCell.walls.left = false;
                    nextCell.walls.right = false;
                }

                nextCell.visited = true;
                stack.push(nextCell);
            } else {
                stack.pop();
            }
        }
        return grid;
    }

    // --- Drawing Functions ---
    function drawMaze() {
        ctx.strokeStyle = WALL_COLOR;
        ctx.lineWidth = 2; // Wall thickness

        for (let r = 0; r < MAZE_ROWS; r++) {
            for (let c = 0; c < MAZE_COLS; c++) {
                const cell = maze[r][c];
                const x = c * CELL_SIZE;
                const y = r * CELL_SIZE;

                if (cell.walls.top) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + CELL_SIZE, y);
                    ctx.stroke();
                }
                if (cell.walls.right) {
                    ctx.beginPath();
                    ctx.moveTo(x + CELL_SIZE, y);
                    ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
                    ctx.stroke();
                }
                if (cell.walls.bottom) {
                    ctx.beginPath();
                    ctx.moveTo(x + CELL_SIZE, y + CELL_SIZE);
                    ctx.lineTo(x, y + CELL_SIZE);
                    ctx.stroke();
                }
                if (cell.walls.left) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + CELL_SIZE);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }
            }
        }
    }

    function drawRect(x, y, size, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * CELL_SIZE + CELL_SIZE * 0.15, y * CELL_SIZE + CELL_SIZE * 0.15, size * 0.7, size * 0.7);
    }
    
    function drawCircle(x, y, radiusFraction, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(
            x * CELL_SIZE + CELL_SIZE / 2,
            y * CELL_SIZE + CELL_SIZE / 2,
            CELL_SIZE * radiusFraction,
            0, Math.PI * 2
        );
        ctx.fill();
    }

    function drawPlayer() {
        drawCircle(player.c, player.r, 0.35, PLAYER_COLOR);
    }

    function drawStartEnd() {
        drawRect(startPos.c, startPos.r, CELL_SIZE, START_COLOR);
        drawRect(endPos.c, endPos.r, CELL_SIZE, END_COLOR);
    }

    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas (background is cave floor)
        drawMaze();
        drawStartEnd();
        drawPlayer();
    }

    // --- Game Logic ---
    function movePlayer(dr, dc) {
        if (gameOver) return;

        const currentCell = maze[player.r][player.c];
        let newR = player.r + dr;
        let newC = player.c + dc;

        let canMove = false;
        if (dr === -1 && !currentCell.walls.top) canMove = true;    // Up
        if (dr === 1 && !currentCell.walls.bottom) canMove = true; // Down
        if (dc === -1 && !currentCell.walls.left) canMove = true;   // Left
        if (dc === 1 && !currentCell.walls.right) canMove = true;  // Right
        
        if (canMove && newR >= 0 && newR < MAZE_ROWS && newC >= 0 && newC < MAZE_COLS) {
            player.r = newR;
            player.c = newC;
            playSound('footstep');
            
            if (is3D) {
                position3DPlayer();
            } else {
                drawGame();
            }

            if (player.r === endPos.r && player.c === endPos.c) {
                gameOver = true;
                messageEl.textContent = "You found the exit! Congratulations!";
                messageEl.style.color = END_COLOR;
                playSound('win');
                window.removeEventListener('keydown', handleKeyDown);
                if (controls) controls.unlock();
            }
        }
    }

    function handleKeyDown(e) {
        // Resume AudioContext on first interaction if it's suspended
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        if (gameOver) return;
        
        if (is3D) {
            // Handle 3D movement
            switch (e.key.toLowerCase()) {
                case 'w': moveState.forward = true; e.preventDefault(); break;
                case 's': moveState.backward = true; e.preventDefault(); break;
                case 'a': moveState.left = true; e.preventDefault(); break;
                case 'd': moveState.right = true; e.preventDefault(); break;
            }
        } else {
            // Handle 2D movement
            switch (e.key) {
                case 'ArrowUp': case 'w': movePlayer(-1, 0); e.preventDefault(); break;
                case 'ArrowDown': case 's': movePlayer(1, 0); e.preventDefault(); break;
                case 'ArrowLeft': case 'a': movePlayer(0, -1); e.preventDefault(); break;
                case 'ArrowRight': case 'd': movePlayer(0, 1); e.preventDefault(); break;
            }
        }
    }

    function handleKeyUp(e) {
        if (is3D) {
            switch (e.key.toLowerCase()) {
                case 'w': moveState.forward = false; e.preventDefault(); break;
                case 's': moveState.backward = false; e.preventDefault(); break;
                case 'a': moveState.left = false; e.preventDefault(); break;
                case 'd': moveState.right = false; e.preventDefault(); break;
            }
        }
    }

    // --- 3D View ---
    let is3D = false;
    let scene, camera, renderer, controls;
    let threeContainer;
    let walls3D = [];
    let player3D, startMarker3D, endMarker3D;
    
    // 3D Movement state
    let moveState = {
        forward: false,
        backward: false,
        left: false,
        right: false
    };
    const moveSpeed = 0.05;

    // Import Three.js modules
    let THREE, PointerLockControls;

    async function loadThreeJS() {
        const threeModule = await import('https://esm.sh/three@0.158.0');
        THREE = threeModule;
        const controlsModule = await import('https://esm.sh/three@0.158.0/examples/jsm/controls/PointerLockControls.js');
        PointerLockControls = controlsModule.PointerLockControls;
    }

    function create3DScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);

        camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        
        renderer = new THREE.WebGLRenderer();
        renderer.setSize(canvas.width, canvas.height);
        
        threeContainer = document.createElement('div');
        threeContainer.id = 'threeContainer';
        threeContainer.appendChild(renderer.domElement);
        canvas.parentNode.insertBefore(threeContainer, canvas.nextSibling);

        controls = new PointerLockControls(camera, renderer.domElement);
        
        renderer.domElement.addEventListener('click', () => {
            if (!gameOver && is3D) {
                controls.lock();
            }
        });

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        scene.add(ambientLight);

        // Add point light following player
        const pointLight = new THREE.PointLight(0xffd700, 1, 10);
        pointLight.position.set(0, 1, 0);
        scene.add(pointLight);

        build3DMaze();
        position3DPlayer();
    }

    function build3DMaze() {
        // Clear existing walls
        walls3D.forEach(wall => scene.remove(wall));
        walls3D = [];

        const wallGeometry = new THREE.BoxGeometry(1, 2, 0.1);
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x504A4B });

        for (let r = 0; r < MAZE_ROWS; r++) {
            for (let c = 0; c < MAZE_COLS; c++) {
                const cell = maze[r][c];
                const x = c - MAZE_COLS / 2;
                const z = r - MAZE_ROWS / 2;

                if (cell.walls.top) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(x, 1, z - 0.5);
                    scene.add(wall);
                    walls3D.push(wall);
                }
                if (cell.walls.right) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(x + 0.5, 1, z);
                    wall.rotation.y = Math.PI / 2;
                    scene.add(wall);
                    walls3D.push(wall);
                }
                if (cell.walls.bottom) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(x, 1, z + 0.5);
                    scene.add(wall);
                    walls3D.push(wall);
                }
                if (cell.walls.left) {
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    wall.position.set(x - 0.5, 1, z);
                    wall.rotation.y = Math.PI / 2;
                    scene.add(wall);
                    walls3D.push(wall);
                }
            }
        }

        // Add floor
        const floorGeometry = new THREE.PlaneGeometry(MAZE_COLS, MAZE_ROWS);
        const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        // Add start and end markers
        if (startMarker3D) scene.remove(startMarker3D);
        if (endMarker3D) scene.remove(endMarker3D);

        const startGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.8);
        const startMaterial = new THREE.MeshLambertMaterial({ color: 0x32CD32 });
        startMarker3D = new THREE.Mesh(startGeometry, startMaterial);
        startMarker3D.position.set(startPos.c - MAZE_COLS / 2, 0.05, startPos.r - MAZE_ROWS / 2);
        scene.add(startMarker3D);

        const endGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.8);
        const endMaterial = new THREE.MeshLambertMaterial({ color: 0xDC143C });
        endMarker3D = new THREE.Mesh(endGeometry, endMaterial);
        endMarker3D.position.set(endPos.c - MAZE_COLS / 2, 0.05, endPos.r - MAZE_ROWS / 2);
        scene.add(endMarker3D);
    }

    function position3DPlayer() {
        if (camera) {
            camera.position.set(
                player.c - MAZE_COLS / 2,
                0.5,
                player.r - MAZE_ROWS / 2
            );
        }
    }

    function checkCollision(newPosition) {
        const playerRadius = 0.3;
        
        for (let wall of walls3D) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                newPosition,
                new THREE.Vector3(playerRadius * 2, playerRadius * 2, playerRadius * 2)
            );
            
            if (wallBox.intersectsBox(playerBox)) {
                return true;
            }
        }
        return false;
    }

    function update3DMovement() {
        if (!is3D || !controls.isLocked) return;
        
        const direction = new THREE.Vector3();
        const right = new THREE.Vector3();
        
        camera.getWorldDirection(direction);
        right.crossVectors(camera.up, direction).normalize();
        
        const moveVector = new THREE.Vector3();
        
        if (moveState.forward) moveVector.add(direction.multiplyScalar(moveSpeed));
        if (moveState.backward) moveVector.add(direction.multiplyScalar(-moveSpeed));
        if (moveState.left) moveVector.add(right.multiplyScalar(moveSpeed));
        if (moveState.right) moveVector.add(right.multiplyScalar(-moveSpeed));
        
        if (moveVector.length() > 0) {
            const newPosition = camera.position.clone().add(moveVector);
            newPosition.y = 0.5; // Keep camera at fixed height
            
            if (!checkCollision(newPosition)) {
                camera.position.copy(newPosition);
                
                // Play footstep sound occasionally
                if (Math.random() < 0.05) {
                    playSound('footstep');
                }
                
                // Check win condition in 3D
                const endX = endPos.c - MAZE_COLS / 2;
                const endZ = endPos.r - MAZE_ROWS / 2;
                const distanceToEnd = camera.position.distanceTo(new THREE.Vector3(endX, 0.5, endZ));
                
                if (distanceToEnd < 0.5 && !gameOver) {
                    gameOver = true;
                    messageEl.textContent = "You found the exit! Congratulations!";
                    messageEl.style.color = END_COLOR;
                    playSound('win');
                    controls.unlock();
                }
            }
        }
    }

    function animate3D() {
        if (!is3D) return;
        
        update3DMovement();
        renderer.render(scene, camera);
        requestAnimationFrame(animate3D);
    }

    async function toggleView() {
        if (!THREE) {
            await loadThreeJS();
        }

        is3D = !is3D;
        
        if (is3D) {
            if (!scene) {
                create3DScene();
            } else {
                position3DPlayer();
            }
            canvas.style.display = 'none';
            threeContainer.style.display = 'block';
            viewToggle.textContent = 'Switch to 2D View';
            messageEl.textContent = 'Click to look around. Use WASD to move in 3D!';
            animate3D();
        } else {
            canvas.style.display = 'block';
            if (threeContainer) threeContainer.style.display = 'none';
            viewToggle.textContent = 'Switch to 3D View';
            messageEl.textContent = 'Use arrow keys or WASD to move. Find the red exit!';
            drawGame();
        }
    }

    // --- Initialization ---
    async function init() {
        messageEl.textContent = "Use arrow keys or WASD to move. Find the red exit!";
        messageEl.style.color = "#76c7c0";

        await loadSound('footstep', 'footstep_cave.mp3');
        await loadSound('win', 'win_chime.mp3');

        maze = generateMaze(MAZE_ROWS, MAZE_COLS);
        
        startPos = { r: 0, c: 0 };
        endPos = { r: MAZE_ROWS - 1, c: MAZE_COLS - 1 };
        if (MAZE_ROWS -1 === 0 && MAZE_COLS -1 === 0 && MAZE_COLS > 1) {
           endPos = {r: 0, c: MAZE_COLS -1};
        } else if (MAZE_ROWS -1 === 0 && MAZE_COLS -1 === 0 && MAZE_ROWS > 1) {
           endPos = {r: MAZE_ROWS -1, c: 0};
        }

        player = { ...startPos };
        gameOver = false;
        is3D = false;
        
        // Reset movement state
        moveState = { forward: false, backward: false, left: false, right: false };

        if (threeContainer) threeContainer.style.display = 'none';
        canvas.style.display = 'block';
        viewToggle.textContent = 'Switch to 3D View';

        drawGame();
        
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        viewToggle.removeEventListener('click', toggleView);
        viewToggle.addEventListener('click', toggleView);
    }

    // A simple restart mechanism could be added, e.g., by calling init() again
    // For now, just initialize on load
    init();
});