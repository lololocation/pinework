const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;

// 获取用户数据目录 (Windows下通常是 C:\Users\YourName\AppData\Roaming\PineWork)
// 这样比直接存放在 C:\Users\YourName 更规范且安全
const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'user_data_v1.txt');

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 350,
    minHeight: 120, // 确保高度足够容纳胶囊
    // 【核心修改】开启透明和无边框
    transparent: true, 
    frame: false,      // 去掉 Windows 自带的标题栏和边框
    hasShadow: true,   // 开启阴影让它更有立体感
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
    createWindow();
    // 打印数据文件路径，方便调试
    console.log('Data File Path:', dataFilePath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 窗口控制指令 (因为去掉了标题栏，需要自己实现关闭/最小化)
ipcMain.on('window-control', (event, arg) => {
  if (!win) return;
  if (arg === 'minimize') win.minimize();
  if (arg === 'close') win.close();
});

// 调整大小指令
ipcMain.on('resize-window', (event, arg) => {
  if (win) {
    const { width, height, mini } = arg;
    const currentScreen = screen.getDisplayMatching(win.getBounds());
    const workArea = currentScreen.workArea;
    
    // 居中计算
    const x = Math.round(workArea.x + (workArea.width - width) / 2);
    const y = Math.round(workArea.y + (workArea.height - height) / 2);

    win.setBounds({ x, y, width, height });
    win.setResizable(!mini); // 迷你模式禁止拉伸
    win.setAlwaysOnTop(mini); // 迷你模式置顶
  }
});

// --- 👇👇👇 新增：数据持久化 IPC 接口 👇👇👇 ---

// 保存数据 (异步)
ipcMain.on('save-data', (event, dataString) => {
    try {
        // 确保目录存在
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        fs.writeFileSync(dataFilePath, dataString, 'utf-8');
        // console.log('Data saved successfully to:', dataFilePath);
    } catch (e) {
        console.error('Failed to save data:', e);
    }
});

// 读取数据 (同步，确保 React 初始化时能拿到)
ipcMain.on('get-data', (event) => {
    try {
        if (fs.existsSync(dataFilePath)) {
            const data = fs.readFileSync(dataFilePath, 'utf-8');
            event.returnValue = data;
        } else {
            event.returnValue = ''; // 文件不存在返回空字符串
        }
    } catch (e) {
        console.error('Failed to load data:', e);
        event.returnValue = '';
    }
});