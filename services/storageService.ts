import { AppData, DEFAULT_SETTINGS, DEFAULT_PURCHASING_ITEMS } from '../types';

// 简单的 XOR 混淆密钥 (防止直接用记事本打开看到明文)
const XOR_KEY = 'pine_tree_secret_key_88'; 

// 混淆函数
const obfuscate = (input: string): string => {
  try {
    // 1. 先用 encodeURIComponent 将 Unicode 字符转为 ASCII 安全的 URI 编码
    // 这样避免了 btoa 处理中文字符时报错 "The string to be encoded contains characters outside of the Latin1 range"
    const safeInput = encodeURIComponent(input);
    
    let output = '';
    for (let i = 0; i < safeInput.length; i++) {
      const charCode = safeInput.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length);
      output += String.fromCharCode(charCode);
    }
    // 转为 Base64 方便存储
    return btoa(output);
  } catch (e) {
    console.error("Obfuscation failed", e);
    // 发生错误时返回空字符串，避免存储坏数据
    return "";
  }
};

// 解混淆函数
const deobfuscate = (input: string): string => {
  try {
    // 1. Base64 解码
    const raw = atob(input);
    
    // 2. XOR 解密
    let output = '';
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length);
      output += String.fromCharCode(charCode);
    }
    
    // 3. URI 解码还原中文
    return decodeURIComponent(output);
  } catch (e) {
    console.error("Deobfuscation failed", e);
    return "";
  }
};

// --- 保存数据 ---
export const saveAppData = (data: AppData): void => {
  try {
    const jsonString = JSON.stringify(data);
    const securedString = obfuscate(jsonString);
    
    if (!securedString) return; // 混淆失败不保存

    // 1. 优先通过 IPC 发送给 Electron 主进程保存
    // @ts-ignore
    if (window.require) {
        // @ts-ignore
        const { ipcRenderer } = window.require('electron');
        // 发送 'save-data' 消息，带上加密后的字符串
        ipcRenderer.send('save-data', securedString);
    }

    // 2. 同时写入 LocalStorage 作为备份 (Web环境或双重保险)
    localStorage.setItem('pinework_data_v1', securedString);
    
  } catch (error) {
    console.error("Error saving data:", error);
  }
};

// --- 读取数据 ---
export const loadAppData = (): AppData => {
  const defaultFocusStats = { date: new Date().toISOString().split('T')[0], minutes: 0 };
  let jsonString = "";
  let loadedFromElectron = false;

  try {
    // 1. 优先通过 IPC 同步获取 Electron 主进程的数据
    // @ts-ignore
    if (window.require) {
        // @ts-ignore
        const { ipcRenderer } = window.require('electron');
        // 发送 'get-data' 并等待返回值 (同步)
        const electronData = ipcRenderer.sendSync('get-data');
        if (electronData && typeof electronData === 'string' && electronData.length > 0) {
            jsonString = deobfuscate(electronData);
            loadedFromElectron = true;
        }
    }

    // 2. 如果 Electron 没数据 (或是第一次运行)，尝试 LocalStorage
    if (!loadedFromElectron || !jsonString) {
        const localContent = localStorage.getItem('pinework_data_v1');
        if (localContent) {
            jsonString = deobfuscate(localContent);
        }
    }

    // 3. 如果还是空的，返回默认值
    if (!jsonString) {
        return { settings: DEFAULT_SETTINGS, tasks: [], focusStats: defaultFocusStats };
    }
    
    // 4. 解析数据并合并默认值 (关键步骤：防止设置丢失)
    const parsed = JSON.parse(jsonString);
    
    // 深度合并设置：用保存的设置覆盖默认设置
    // 这样即使 DEFAULT_SETTINGS 增加了新字段，老存档也不会报错
    const mergedSettings = { 
        ...DEFAULT_SETTINGS, 
        ...(parsed.settings || {}) 
    };
    
    // 数据迁移补丁：确保购买项存在
    if (!mergedSettings.purchasingItems || mergedSettings.purchasingItems.length === 0) {
        mergedSettings.purchasingItems = DEFAULT_PURCHASING_ITEMS;
    }

    return {
        settings: mergedSettings,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        focusStats: parsed.focusStats || defaultFocusStats
    };

  } catch (error) {
    console.error("Error loading data:", error);
    // 出错时返回默认值，防止白屏
    return { settings: DEFAULT_SETTINGS, tasks: [], focusStats: defaultFocusStats };
  }
};