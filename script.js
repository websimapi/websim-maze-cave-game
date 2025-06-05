document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const messageEl = document.getElementById('message');

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
            drawGame();

            if (player.r === endPos.r && player.c === endPos.c) {
                gameOver = true;
                messageEl.textContent = "You found the exit! Congratulations!";
                messageEl.style.color = END_COLOR;
                playSound('win');
                window.removeEventListener('keydown', handleKeyDown); // Disable controls
            }
        }
    }

    function handleKeyDown(e) {
        // Resume AudioContext on first interaction if it's suspended
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        if (gameOver) return;
        switch (e.key) {
            case 'ArrowUp': case 'w': movePlayer(-1, 0); e.preventDefault(); break;
            case 'ArrowDown': case 's': movePlayer(1, 0); e.preventDefault(); break;
            case 'ArrowLeft': case 'a': movePlayer(0, -1); e.preventDefault(); break;
            case 'ArrowRight': case 'd': movePlayer(0, 1); e.preventDefault(); break;
        }
    }
    
    async function init() {
        messageEl.textContent = "Use arrow keys or WASD to move. Find the red exit!";
        messageEl.style.color = "#76c7c0"; // Reset color

        await loadSound('footstep', 'footstep_cave.mp3');
        await loadSound('win', 'win_chime.mp3');

        maze = generateMaze(MAZE_ROWS, MAZE_COLS);
        
        startPos = { r: 0, c: 0 };
        // Ensure endPos is different from startPos, typically bottom-right
        endPos = { r: MAZE_ROWS - 1, c: MAZE_COLS - 1 };
        if (MAZE_ROWS -1 === 0 && MAZE_COLS -1 === 0 && MAZE_COLS > 1) { // Single row maze
           endPos = {r: 0, c: MAZE_COLS -1};
        } else if (MAZE_ROWS -1 === 0 && MAZE_COLS -1 === 0 && MAZE_ROWS > 1) { // Single col maze
           endPos = {r: MAZE_ROWS -1, c: 0};
        }


        player = { ...startPos };
        gameOver = false;

        drawGame();
        
        window.removeEventListener('keydown', handleKeyDown); // Remove old listener if game is restarted
        window.addEventListener('keydown', handleKeyDown);
    }

    // A simple restart mechanism could be added, e.g., by calling init() again
    // For now, just initialize on load
    init();
});

