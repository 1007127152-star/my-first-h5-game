/* ============================================================
   木质数字拼图 - 游戏逻辑
   - 4×4 棋盘，15 个数字方块 + 1 个空格
   - 通过合法移动打乱，保证可解
   - 支持点击移动 + 键盘方向键
   - 步数计数 + 计时 + 胜利判定
   ============================================================ */

(function () {
    "use strict";

    // ---------- 基本配置 ----------
    const SIZE = 4;          // 4×4 棋盘
    const TOTAL = SIZE * SIZE; // 共 16 格
    const EMPTY = 0;         // 用 0 表示空格

    // ---------- 游戏状态 ----------
    let board = [];          // 长度 16 的数组，存放当前棋盘数字
    let emptyIndex = TOTAL - 1; // 空格当前位置（默认右下角）
    let steps = 0;           // 步数
    let timerId = null;      // 计时器 ID
    let seconds = 0;         // 已用秒数
    let started = false;     // 是否已开始计时
    let won = false;         // 是否已胜利

    // ---------- DOM 元素引用 ----------
    const boardEl   = document.getElementById("board");
    const stepsEl   = document.getElementById("steps");
    const timeEl    = document.getElementById("time");
    const winMask   = document.getElementById("winMask");
    const winSteps  = document.getElementById("winSteps");
    const winTime   = document.getElementById("winTime");
    const restartBtns = document.querySelectorAll(".btn-restart");

    /* ============================================================
       一、棋盘初始化与渲染
       ============================================================ */

    /**
     * 初始化为已解状态：[1,2,...,15,0]
     * 空格在右下角。
     */
    function initSolvedBoard() {
        board = [];
        for (let i = 1; i < TOTAL; i++) {
            board.push(i);
        }
        board.push(EMPTY);
        emptyIndex = TOTAL - 1;
    }

    /**
     * 渲染棋盘：为每个数字创建方块 DOM，并用绝对定位放置。
     * 方块尺寸为棋盘的 25%，位置用百分比表示，便于滑动动画。
     */
    function renderBoard() {
        boardEl.innerHTML = "";
        for (let i = 0; i < TOTAL; i++) {
            const value = board[i];
            if (value === EMPTY) continue; // 空格不渲染方块

            const tile = document.createElement("div");
            tile.className = "tile";
            tile.dataset.value = value;

            // 根据下标计算行列位置（百分比）
            const row = Math.floor(i / SIZE);
            const col = i % SIZE;
            tile.style.left = (col * 25) + "%";
            tile.style.top  = (row * 25) + "%";

            const inner = document.createElement("div");
            inner.className = "tile-inner";
            inner.textContent = value;
            tile.appendChild(inner);

            // 点击方块尝试移动
            tile.addEventListener("click", function () {
                tryMoveByIndex(i);
            });

            boardEl.appendChild(tile);
        }
        updateMovableHighlight();
    }

    /**
     * 更新可移动方块的高亮提示。
     * 与空格相邻的方块加上 .movable 类。
     */
    function updateMovableHighlight() {
        const tiles = boardEl.querySelectorAll(".tile");
        const neighbors = getNeighbors(emptyIndex);
        tiles.forEach(function (tile) {
            // 通过 left/top 反推下标
            const left = parseFloat(tile.style.left);
            const top  = parseFloat(tile.style.top);
            const col = Math.round(left / 25);
            const row = Math.round(top / 25);
            const idx = row * SIZE + col;
            if (neighbors.indexOf(idx) !== -1) {
                tile.classList.add("movable");
            } else {
                tile.classList.remove("movable");
            }
        });
    }

    /* ============================================================
       二、移动逻辑
       ============================================================ */

    /**
     * 获取某个下标在棋盘上的相邻格下标（上、下、左、右）。
     */
    function getNeighbors(index) {
        const row = Math.floor(index / SIZE);
        const col = index % SIZE;
        const result = [];
        if (row > 0)        result.push(index - SIZE); // 上
        if (row < SIZE - 1) result.push(index + SIZE); // 下
        if (col > 0)        result.push(index - 1);    // 左
        if (col < SIZE - 1) result.push(index + 1);    // 右
        return result;
    }

    /**
     * 判断某个方块是否与空格相邻（可移动）。
     */
    function isAdjacentToEmpty(index) {
        return getNeighbors(emptyIndex).indexOf(index) !== -1;
    }

    /**
     * 交换棋盘中两个位置的内容，并更新空格位置。
     */
    function swap(i, j) {
        const tmp = board[i];
        board[i] = board[j];
        board[j] = tmp;
    }

    /**
     * 尝试移动指定下标的方块。
     * 若该方块与空格相邻，则交换并触发动画、计数、胜利检查。
     * @param {number} index 被点击/操作的方块下标
     * @returns {boolean} 是否成功移动
     */
    function tryMoveByIndex(index) {
        if (won) return false; // 胜利后不再移动
        if (!isAdjacentToEmpty(index)) return false;

        // 第一次移动时启动计时
        if (!started) startTimer();

        // 交换数据
        swap(index, emptyIndex);
        const oldEmpty = emptyIndex;
        emptyIndex = index;

        // 移动对应的 DOM 方块到原空格位置（带动画）
        moveTileDom(index, oldEmpty);

        steps++;
        updateSteps();
        updateMovableHighlight();

        // 检查胜利
        if (checkWin()) {
            handleWin();
        }
        return true;
    }

    /**
     * 把某个下标对应的方块 DOM 移动到目标位置（百分比坐标）。
     * @param {number} fromIndex 方块当前所在下标
     * @param {number} toIndex   目标下标（原空格位置）
     */
    function moveTileDom(fromIndex, toIndex) {
        const tiles = boardEl.querySelectorAll(".tile");
        let target = null;
        tiles.forEach(function (tile) {
            const left = parseFloat(tile.style.left);
            const top  = parseFloat(tile.style.top);
            const col = Math.round(left / 25);
            const row = Math.round(top / 25);
            if (row * SIZE + col === fromIndex) {
                target = tile;
            }
        });
        if (!target) return;

        const toRow = Math.floor(toIndex / SIZE);
        const toCol = toIndex % SIZE;
        target.style.left = (toCol * 25) + "%";
        target.style.top  = (toRow * 25) + "%";
    }

    /**
     * 通过方向键移动方块。
     * 约定：方向键代表"方块滑动的方向"。
     * 例如按"下"，表示空格上方的方块向下滑入空格。
     * @param {string} dir 'up' | 'down' | 'left' | 'right'
     */
    function moveByDirection(dir) {
        if (won) return;
        const row = Math.floor(emptyIndex / SIZE);
        const col = emptyIndex % SIZE;
        let targetIndex = -1;

        switch (dir) {
            case "up":    // 空格下方的方块上移 -> 空格下移
                if (row < SIZE - 1) targetIndex = emptyIndex + SIZE;
                break;
            case "down":  // 空格上方的方块下移 -> 空格上移
                if (row > 0) targetIndex = emptyIndex - SIZE;
                break;
            case "left":  // 空格右侧的方块左移 -> 空格右移
                if (col < SIZE - 1) targetIndex = emptyIndex + 1;
                break;
            case "right": // 空格左侧的方块右移 -> 空格左移
                if (col > 0) targetIndex = emptyIndex - 1;
                break;
        }
        if (targetIndex >= 0) {
            tryMoveByIndex(targetIndex);
        }
    }

    /* ============================================================
       三、打乱棋盘（保证可解）
       ============================================================ */

    /**
     * 通过随机执行合法移动来打乱棋盘。
     * 这种方式天然保证结果一定可解。
     * @param {number} times 移动次数，越多越乱
     */
    function shuffle(times) {
        let lastMoved = -1; // 上一次移动的方块下标，避免来回抵消
        for (let i = 0; i < times; i++) {
            const neighbors = getNeighbors(emptyIndex)
                .filter(function (n) { return n !== lastMoved; });
            const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
            swap(pick, emptyIndex);
            lastMoved = emptyIndex;
            emptyIndex = pick;
        }
        // 极小概率打乱后仍是已解状态，若是则再打乱一次
        if (checkWin()) shuffle(times);
    }

    /* ============================================================
       四、胜利判定
       ============================================================ */

    /**
     * 检查是否已排列成正确顺序：[1,2,...,15,0]
     */
    function checkWin() {
        for (let i = 0; i < TOTAL - 1; i++) {
            if (board[i] !== i + 1) return false;
        }
        return board[TOTAL - 1] === EMPTY;
    }

    /**
     * 处理胜利：停止计时、显示弹窗、方块闪光。
     */
    function handleWin() {
        won = true;
        stopTimer();
        boardEl.classList.add("win");
        winSteps.textContent = steps;
        winTime.textContent = formatTime(seconds);
        // 稍延迟显示弹窗，让玩家看到最后一步滑动
        setTimeout(function () {
            winMask.classList.add("show");
        }, 350);
    }

    /* ============================================================
       五、计时与步数
       ============================================================ */

    function startTimer() {
        if (timerId) return;
        started = true;
        timerId = setInterval(function () {
            seconds++;
            updateTime();
        }, 1000);
    }

    function stopTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function resetTimer() {
        stopTimer();
        seconds = 0;
        started = false;
        updateTime();
    }

    function updateTime() {
        timeEl.textContent = formatTime(seconds);
    }

    function updateSteps() {
        stepsEl.textContent = steps;
    }

    /**
     * 把秒数格式化为 mm:ss。
     */
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }

    /* ============================================================
       六、重新开始
       ============================================================ */

    function restart() {
        // 关闭弹窗
        winMask.classList.remove("show");
        boardEl.classList.remove("win");
        won = false;
        steps = 0;
        updateSteps();
        resetTimer();

        // 重新初始化并打乱
        initSolvedBoard();
        shuffle(200); // 200 次合法移动，足够打乱
        renderBoard();
    }

    /* ============================================================
       七、事件绑定
       ============================================================ */

    // 所有"重新开始"按钮
    restartBtns.forEach(function (btn) {
        btn.addEventListener("click", restart);
    });

    // 键盘方向键
    document.addEventListener("keydown", function (e) {
        const map = {
            ArrowUp: "up",
            ArrowDown: "down",
            ArrowLeft: "left",
            ArrowRight: "right",
            // 兼容 WASD
            w: "up", W: "up",
            s: "down", S: "down",
            a: "left", A: "left",
            d: "right", D: "right"
        };
        if (map[e.key]) {
            e.preventDefault();
            moveByDirection(map[e.key]);
        }
    });

    /* ============================================================
       八、启动游戏
       ============================================================ */
    initSolvedBoard();
    shuffle(200);
    renderBoard();
    updateSteps();
    updateTime();

})();
