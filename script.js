import * as THREE from 'three';

document.addEventListener('DOMContentLoaded', () => {
    const canvas2D = document.getElementById('gameCanvas2D');
    const canvas3D = document.getElementById('gameCanvas3D');
    const ctx = canvas2D.getContext('2d');
    const messageEl = document.getElementById('message');
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const restartBtn = document.getElementById('restartBtn');

    const CELL_SIZE = 25;
    const MAZE_COLS = 24;
    const MAZE_ROWS = 16;

    // Set dimensions for both canvases
    canvas2D.width = MAZE_COLS * CELL_SIZE;
    canvas2D.height = MAZE_ROWS * CELL_SIZE;
    canvas3D.width = MAZE_COLS * CELL_SIZE; // Can be different if desired
    canvas3D.height = MAZE_ROWS * CELL_SIZE; // Can be different if desired

    const WALL_COLOR = '#504A4B';
    const PLAYER_COLOR = '#FFD700'; // For 2D player
    const START_COLOR = '#32CD32';
    const END_COLOR = '#DC143C';
    const FLOOR_COLOR_3D = '#333333';
    const CEILING_COLOR_3D = '#222222';
    const PLAYER_HEIGHT_3D = CELL_SIZE * 0.5; // Camera height in 3D
    const WALL_HEIGHT_3D = CELL_SIZE;
    const WALL_THICKNESS_3D = CELL_SIZE * 0.1;

    let maze;
    let player; // Will store {r, c, orientation}
    let startPos;
    let endPos;
    let gameOver = false;
    let is3DView = false;
    let threeDMazeNeedsRebuild = true; // Flag to indicate 3D geometry needs update

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
    
    // --- Three.js Specifics ---
    let scene, camera, renderer;
    let wallMaterial3D, floorMaterial3D, ceilingMaterial3D, startMarkerMaterial3D, endMarkerMaterial3D;
    let threeJSInitialized = false;
    const mazeObjects3D = new THREE.Group(); // To hold maze walls, start/end markers for easy clearing

    function initThreeJS() {
        if (threeJSInitialized) return;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, canvas3D.width / canvas3D.height, 0.1, CELL_SIZE * MAZE_COLS * 2);
        
        // Use canvas3D for the WebGLRenderer
        renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true });
        renderer.setSize(canvas3D.width, canvas3D.height);
        // The canvas CSS background-color (#333333) will show through transparent areas
        renderer.setClearColor(0x000000, 0); 

        wallMaterial3D = new THREE.MeshBasicMaterial({ color: WALL_COLOR });
        floorMaterial3D = new THREE.MeshBasicMaterial({ color: FLOOR_COLOR_3D });
        ceilingMaterial3D = new THREE.MeshBasicMaterial({ color: CEILING_COLOR_3D });
        startMarkerMaterial3D = new THREE.MeshBasicMaterial({ color: START_COLOR });
        endMarkerMaterial3D = new THREE.MeshBasicMaterial({ color: END_COLOR });
        
        scene.add(mazeObjects3D);

        threeJSInitialized = true;
    }

    function setup3DScene() {
        // Ensure Three.js core components are initialized (renderer, scene, camera)
        // This function focuses on populating the scene with maze geometry.
        if (!threeJSInitialized) {
             // This case should ideally be handled by the caller (e.g. toggleViewMode or init)
             // ensuring initThreeJS() is called first.
            console.warn("setup3DScene called before initThreeJS. Initializing now.");
            initThreeJS();
        }

        // Clear previous maze objects
        while(mazeObjects3D.children.length > 0){ 
            mazeObjects3D.remove(mazeObjects3D.children[0]); 
        }

        // Floor
        const floorGeometry = new THREE.PlaneGeometry(MAZE_COLS * CELL_SIZE, MAZE_ROWS * CELL_SIZE);
        const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial3D);
        floorMesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        floorMesh.position.set( (MAZE_COLS * CELL_SIZE) / 2, 0, (MAZE_ROWS * CELL_SIZE) / 2 );
        mazeObjects3D.add(floorMesh);

        // Ceiling
        const ceilingGeometry = new THREE.PlaneGeometry(MAZE_COLS * CELL_SIZE, MAZE_ROWS * CELL_SIZE);
        const ceilingMesh = new THREE.Mesh(ceilingGeometry, ceilingMaterial3D);
        ceilingMesh.rotation.x = Math.PI / 2;
        ceilingMesh.position.set( (MAZE_COLS * CELL_SIZE) / 2, WALL_HEIGHT_3D, (MAZE_ROWS * CELL_SIZE) / 2 );
        mazeObjects3D.add(ceilingMesh);

        // Walls
        for (let r = 0; r < MAZE_ROWS; r++) {
            for (let c = 0; c < MAZE_COLS; c++) {
                const cell = maze[r][c];
                const wallHeight = WALL_HEIGHT_3D;
                const wallThickness = WALL_THICKNESS_3D;

                // Top wall
                if (cell.walls.top) {
                    const wallGeo = new THREE.BoxGeometry(CELL_SIZE + wallThickness, wallHeight, wallThickness);
                    const wallMesh = new THREE.Mesh(wallGeo, wallMaterial3D);
                    wallMesh.position.set(c * CELL_SIZE + CELL_SIZE / 2, wallHeight / 2, r * CELL_SIZE);
                    mazeObjects3D.add(wallMesh);
                }
                // Bottom wall (only draw if it's an edge or not handled by cell below)
                 if (cell.walls.bottom && r === MAZE_ROWS - 1) { // Draw bottom boundary walls
                    const wallGeo = new THREE.BoxGeometry(CELL_SIZE + wallThickness, wallHeight, wallThickness);
                    const wallMesh = new THREE.Mesh(wallGeo, wallMaterial3D);
                    wallMesh.position.set(c * CELL_SIZE + CELL_SIZE / 2, wallHeight / 2, (r + 1) * CELL_SIZE);
                    mazeObjects3D.add(wallMesh);
                }
                // Left wall
                if (cell.walls.left) {
                    const wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, CELL_SIZE + wallThickness);
                    const wallMesh = new THREE.Mesh(wallGeo, wallMaterial3D);
                    wallMesh.position.set(c * CELL_SIZE, wallHeight / 2, r * CELL_SIZE + CELL_SIZE / 2);
                    mazeObjects3D.add(wallMesh);
                }
                 // Right wall (only draw if it's an edge or not handled by cell to the right)
                if (cell.walls.right && c === MAZE_COLS -1) { // Draw right boundary walls
                    const wallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, CELL_SIZE + wallThickness);
                    const wallMesh = new THREE.Mesh(wallGeo, wallMaterial3D);
                    wallMesh.position.set((c + 1) * CELL_SIZE, wallHeight / 2, r * CELL_SIZE + CELL_SIZE / 2);
                    mazeObjects3D.add(wallMesh);
                }
            }
        }
        
        // Start and End Markers (small cubes on the floor)
        const markerSize = CELL_SIZE * 0.5;
        const markerGeo = new THREE.BoxGeometry(markerSize, markerSize, markerSize);
        
        const startMarker = new THREE.Mesh(markerGeo, startMarkerMaterial3D);
        startMarker.position.set(
            startPos.c * CELL_SIZE + CELL_SIZE / 2,
            markerSize / 2,
            startPos.r * CELL_SIZE + CELL_SIZE / 2
        );
        mazeObjects3D.add(startMarker);

        const endMarker = new THREE.Mesh(markerGeo, endMarkerMaterial3D);
        endMarker.position.set(
            endPos.c * CELL_SIZE + CELL_SIZE / 2,
            markerSize / 2,
            endPos.r * CELL_SIZE + CELL_SIZE / 2
        );
        mazeObjects3D.add(endMarker);
        threeDMazeNeedsRebuild = false; // Mark 3D scene as up-to-date
    }
    
    function render3DView() {
        if (!threeJSInitialized || !scene || !camera || !renderer) return;

        // Position camera based on player
        camera.position.set(
            player.c * CELL_SIZE + CELL_SIZE / 2,
            PLAYER_HEIGHT_3D,
            player.r * CELL_SIZE + CELL_SIZE / 2
        );

        // Orient camera
        // 0:N (-Z), 1:E (+X), 2:S (+Z), 3:W (-X)
        // Three.js default camera looks along -Z.
        // Player N (maze -r / three.js -Z): camera rotation.y = 0
        // Player E (maze +c / three.js +X): camera rotation.y = -Math.PI / 2
        // Player S (maze +r / three.js +Z): camera rotation.y = Math.PI
        // Player W (maze -c / three.js -X): camera rotation.y = Math.PI / 2
        switch (player.orientation) {
            case 0: camera.rotation.y = 0; break; // North
            case 1: camera.rotation.y = -Math.PI / 2; break; // East
            case 2: camera.rotation.y = Math.PI; break; // South
            case 3: camera.rotation.y = Math.PI / 2; break; // West
        }
        
        // Ensure camera looks parallel to ground
        camera.rotation.x = 0;
        camera.rotation.z = 0;
        camera.lookAt( // Calculate lookAt point
            camera.position.x + Math.sin(camera.rotation.y) * (player.orientation === 2 || player.orientation === 0 ? -1 : 1) * CELL_SIZE, //Sign flip for N/S
            PLAYER_HEIGHT_3D,
            camera.position.z + Math.cos(camera.rotation.y) * (player.orientation === 2 || player.orientation === 0 ? -1 : 1) * CELL_SIZE  //Sign flip for N/S
        );


        renderer.render(scene, camera);
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

            if (r > 0 && !grid[r - 1][c].visited) neighbors.push(grid[r - 1][c]);
            if (c < cols - 1 && !grid[r][c + 1].visited) neighbors.push(grid[r][c + 1]);
            if (r < rows - 1 && !grid[r + 1][c].visited) neighbors.push(grid[r + 1][c]);
            if (c > 0 && !grid[r][c - 1].visited) neighbors.push(grid[r][c - 1]);

            if (neighbors.length > 0) {
                const nextCell = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                if (nextCell.r < r) { currentCell.walls.top = false; nextCell.walls.bottom = false; } 
                else if (nextCell.c > c) { currentCell.walls.right = false; nextCell.walls.left = false; } 
                else if (nextCell.r > r) { currentCell.walls.bottom = false; nextCell.walls.top = false; } 
                else if (nextCell.c < c) { currentCell.walls.left = false; nextCell.walls.right = false; }

                nextCell.visited = true;
                stack.push(nextCell);
            } else {
                stack.pop();
            }
        }
        return grid;
    }

    // --- 2D Drawing Functions ---
    function drawMaze2D() {
        ctx.strokeStyle = WALL_COLOR;
        ctx.lineWidth = 2; 

        for (let r = 0; r < MAZE_ROWS; r++) {
            for (let c = 0; c < MAZE_COLS; c++) {
                const cell = maze[r][c];
                const x = c * CELL_SIZE;
                const y = r * CELL_SIZE;

                if (cell.walls.top) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL_SIZE, y); ctx.stroke(); }
                if (cell.walls.right) { ctx.beginPath(); ctx.moveTo(x + CELL_SIZE, y); ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE); ctx.stroke(); }
                if (cell.walls.bottom) { ctx.beginPath(); ctx.moveTo(x + CELL_SIZE, y + CELL_SIZE); ctx.lineTo(x, y + CELL_SIZE); ctx.stroke(); }
                if (cell.walls.left) { ctx.beginPath(); ctx.moveTo(x, y + CELL_SIZE); ctx.lineTo(x, y); ctx.stroke(); }
            }
        }
    }

    function drawRect2D(x, y, size, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * CELL_SIZE + CELL_SIZE * 0.15, y * CELL_SIZE + CELL_SIZE * 0.15, size * 0.7, size * 0.7);
    }
    
    function drawCircle2D(x, y, radiusFraction, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc( x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE * radiusFraction, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawPlayer2D() {
        drawCircle2D(player.c, player.r, 0.35, PLAYER_COLOR);
    }

    function drawStartEnd2D() {
        drawRect2D(startPos.c, startPos.r, CELL_SIZE, START_COLOR);
        drawRect2D(endPos.c, endPos.r, CELL_SIZE, END_COLOR);
    }

    function draw2DView() {
        ctx.clearRect(0, 0, canvas2D.width, canvas2D.height); 
        // Ensure canvas background (cave floor) is drawn if not transparent
        ctx.fillStyle = FLOOR_COLOR_3D; // Use same as 3D floor for consistency
        ctx.fillRect(0, 0, canvas2D.width, canvas2D.height);

        drawMaze2D();
        drawStartEnd2D();
        drawPlayer2D();
    }
    
    // --- Unified Drawing Function ---
    function redrawCurrentView() {
        if (gameOver && !is3DView) { // Don't clear canvas if game over in 2D to show final state
             // For 3D, render one last time if needed, or do nothing.
             if(is3DView && renderer && scene && camera) renderer.render(scene, camera); // render last frame
             return;
        }

        if (is3DView) {
            if (!threeJSInitialized) {
                initThreeJS();
                setup3DScene(); // Build geometry first time
            }
            render3DView();
        } else {
            draw2DView();
        }
    }


    // --- Game Logic ---
    function checkWinCondition() {
        if (player.r === endPos.r && player.c === endPos.c) {
            gameOver = true;
            messageEl.textContent = "You found the exit! Congratulations!";
            messageEl.style.color = END_COLOR;
            playSound('win');
            window.removeEventListener('keydown', handleKeyDown); 
        }
    }

    function movePlayer2D(dr, dc) {
        if (gameOver) return;

        const currentCell = maze[player.r][player.c];
        let newR = player.r + dr;
        let newC = player.c + dc;

        let canMove = false;
        if (dr === -1 && !currentCell.walls.top) canMove = true;    
        if (dr === 1 && !currentCell.walls.bottom) canMove = true; 
        if (dc === -1 && !currentCell.walls.left) canMove = true;   
        if (dc === 1 && !currentCell.walls.right) canMove = true;  
        
        if (canMove && newR >= 0 && newR < MAZE_ROWS && newC >= 0 && newC < MAZE_COLS) {
            player.r = newR;
            player.c = newC;
            playSound('footstep');
            redrawCurrentView();
            checkWinCondition();
        }
    }

    function turnPlayer3D(direction) { // -1 for left, 1 for right
        if (gameOver) return;
        player.orientation = (player.orientation + direction + 4) % 4;
        playSound('footstep'); // Optional: different sound for turning? For now, use footstep.
        redrawCurrentView();
    }
    
    function movePlayer3D(isForward) {
        if (gameOver) return;

        const currentCell = maze[player.r][player.c];
        let dr = 0, dc = 0;
        const moveStep = isForward ? 1 : -1;

        // Determine dr, dc based on orientation
        // Player N (maze -r): dr = -1
        // Player E (maze +c): dc = 1
        // Player S (maze +r): dr = 1
        // Player W (maze -c): dc = -1
        switch (player.orientation) {
            case 0: dr = -moveStep; break; // North
            case 1: dc = moveStep; break;  // East
            case 2: dr = moveStep; break;  // South
            case 3: dc = -moveStep; break; // West
        }
        
        let canMove = false;
        if (player.orientation === 0) canMove = isForward ? !currentCell.walls.top : !maze[player.r-1]?.[player.c]?.walls.bottom; // Forward N, Backward S from cell above
        if (player.orientation === 1) canMove = isForward ? !currentCell.walls.right : !maze[player.r]?.[player.c-1]?.walls.left; // Forward E, Backward W from cell left
        if (player.orientation === 2) canMove = isForward ? !currentCell.walls.bottom : !maze[player.r+1]?.[player.c]?.walls.top; // Forward S, Backward N from cell below
        if (player.orientation === 3) canMove = isForward ? !currentCell.walls.left : !maze[player.r]?.[player.c+1]?.walls.right; // Forward W, Backward E from cell right
        
        // A bit complex logic for backward, let's simplify wall checking:
        // Always check the wall OF THE CURRENT CELL in the direction of movement.
        // For moving backward, it's like moving forward from the target cell, but in reverse.
        // So, if moving backward, check the wall of the TARGET cell that faces the current cell.

        let targetR = player.r + dr;
        let targetC = player.c + dc;

        if (targetR < 0 || targetR >= MAZE_ROWS || targetC < 0 || targetC >= MAZE_COLS) {
            canMove = false; // Out of bounds
        } else {
            if (dr === -1 && !currentCell.walls.top) canMove = true;      // Moving North (Up)
            else if (dr === 1 && !currentCell.walls.bottom) canMove = true; // Moving South (Down)
            else if (dc === -1 && !currentCell.walls.left) canMove = true;    // Moving West (Left)
            else if (dc === 1 && !currentCell.walls.right) canMove = true;   // Moving East (Right)
            else canMove = false; // Hit a wall in current cell's perspective
        }


        if (canMove) {
            player.r = targetR;
            player.c = targetC;
            playSound('footstep');
            redrawCurrentView();
            checkWinCondition();
        }
    }


    function handleKeyDown(e) {
        if (audioContext.state === 'suspended') audioContext.resume();
        if (gameOver) return;

        if (is3DView) {
            switch (e.key) {
                case 'ArrowUp': case 'w': movePlayer3D(true); e.preventDefault(); break;
                case 'ArrowDown': case 's': movePlayer3D(false); e.preventDefault(); break;
                case 'ArrowLeft': case 'a': turnPlayer3D(-1); e.preventDefault(); break;
                case 'ArrowRight': case 'd': turnPlayer3D(1); e.preventDefault(); break;
            }
        } else { // 2D movement
            switch (e.key) {
                case 'ArrowUp': case 'w': movePlayer2D(-1, 0); e.preventDefault(); break;
                case 'ArrowDown': case 's': movePlayer2D(1, 0); e.preventDefault(); break;
                case 'ArrowLeft': case 'a': movePlayer2D(0, -1); e.preventDefault(); break;
                case 'ArrowRight': case 'd': movePlayer2D(0, 1); e.preventDefault(); break;
            }
        }
    }
    
    function toggleViewMode() {
        is3DView = !is3DView;
        if (is3DView) {
            canvas2D.style.display = 'none';
            canvas3D.style.display = 'block';
            toggleViewBtn.textContent = "Switch to 2D View";
            if (!threeJSInitialized) {
                initThreeJS(); 
                // threeDMazeNeedsRebuild should be true, so setup3DScene will be called below
            }
            if (threeDMazeNeedsRebuild) { // If maze changed or first time in 3D
                 setup3DScene(); // Populate the 3D scene with maze geometry
            }
        } else {
            canvas3D.style.display = 'none';
            canvas2D.style.display = 'block';
            toggleViewBtn.textContent = "Switch to 3D View";
            // 2D view will be redrawn by redrawCurrentView()
        }
        // gameOver = false; // Resetting gameOver on view toggle might be confusing if player just won.
                           // Consider if this is desired behavior. For now, keep as is.
        messageEl.textContent = "Use arrow keys or WASD to move."; 
        if (gameOver) { // If game was over, re-display win message
             messageEl.textContent = "You found the exit! Congratulations!";
             messageEl.style.color = END_COLOR;
        } else {
            messageEl.style.color = "#76c7c0";
        }
        redrawCurrentView();
    }

    async function init() {
        messageEl.textContent = "Use arrow keys or WASD to move. Find the red exit!";
        messageEl.style.color = "#76c7c0";

        await loadSound('footstep', '/footstep_cave.mp3');
        await loadSound('win', '/win_chime.mp3');

        maze = generateMaze(MAZE_ROWS, MAZE_COLS);
        threeDMazeNeedsRebuild = true; // New maze means 3D scene needs rebuilding
        
        startPos = { r: 0, c: 0 };
        endPos = { r: MAZE_ROWS - 1, c: MAZE_COLS - 1 };
        if (MAZE_ROWS -1 === 0 && MAZE_COLS -1 === 0) { // 1x1 maze, ensure end is distinct if possible
            if (MAZE_COLS > 1) endPos = {r: 0, c: MAZE_COLS -1};
            else if (MAZE_ROWS > 1) endPos = {r: MAZE_ROWS -1, c: 0};
        }

        player = { ...startPos, orientation: 0 }; // 0:N, 1:E, 2:S, 3:W
        gameOver = false;
        
        if (is3DView) { // If restarting while in 3D view
            if (!threeJSInitialized) {
                initThreeJS(); // Initialize core Three.js if it hasn't been yet
            }
            setup3DScene(); // Rebuild 3D maze geometry
        }
        // If restarting in 2D view, 3D scene will be built when toggling to 3D,
        // due to threeDMazeNeedsRebuild flag.

        redrawCurrentView();
        
        window.removeEventListener('keydown', handleKeyDown); 
        window.addEventListener('keydown', handleKeyDown);
    }
    
    toggleViewBtn.addEventListener('click', toggleViewMode);
    restartBtn.addEventListener('click', init);

    init();
});