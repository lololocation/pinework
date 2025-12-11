import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  SettingsIcon, CheckCircleIcon, PlusIcon, TrashIcon, BriefcaseIcon, ClockIcon, 
  MaximizeIcon, MinimizeIcon, ZapIcon, LogOutIcon, XIcon
} from './components/Icons';
import SettingsModal from './components/SettingsModal';
import { Task, AppData } from './types';
import { loadAppData, saveAppData } from './services/storageService';
import { translations } from './translations';
import { applyTheme, getThemeGradient } from './themes';

function App() {
  const [data, setData] = useState<AppData>({ settings: {} as any, tasks: [], focusStats: { date: '', minutes: 0 } });
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [earnedToday, setEarnedToday] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [timeUntilOffWork, setTimeUntilOffWork] = useState("");
  const [quote, setQuote] = useState("");

  // Feature States
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [pomodoroLeft, setPomodoroLeft] = useState(25 * 60);
  const [isPomodoroActive, setIsPomodoroActive] = useState(false);

  // Refs for animation loop
  const requestRef = useRef<number>(0);

  // 1. 初始化数据 (这段是你之前不小心删掉的，必须加回来！)
  // Initialize
  useEffect(() => {
    const loadedData = loadAppData();
    
    // Check if focus stats need reset (new day)
    const todayStr = new Date().toISOString().split('T')[0];
    if (loadedData.focusStats?.date !== todayStr) {
      loadedData.focusStats = { date: todayStr, minutes: 0 };
    }

    // Set initial pomodoro duration
    const initialDuration = loadedData.settings.pomodoroDuration || 25;
    setPomodoroLeft(initialDuration * 60);

    setData(loadedData);
    setIsLoaded(true);
  }, []);

// ------------------------------------------------------
  // 2. 监听 Mini 模式变化 
  // ------------------------------------------------------
  useEffect(() => {
    try {
      // @ts-ignore
      if (window.require) {
        // @ts-ignore
        const { ipcRenderer } = window.require('electron');

        if (isMiniMode) {
          // 变身 Mini 模式：尺寸改为 360x130 (刚好包住那个悬浮条)，并置顶
          ipcRenderer.send('resize-window', { width: 380, height: 95, mini: true });
        } else {
          // 变回 正常模式：恢复大尺寸 1200x800，取消置顶
          ipcRenderer.send('resize-window', { width: 1000, height: 700, mini: false });
        }
      }
    } catch (e) {
      console.log('Browser mode (not electron), skipping resize');
    }
  }, [isMiniMode]); // 依赖项是 isMiniMode



  // Persistence
  useEffect(() => {
    if (isLoaded) {
      saveAppData(data);
    }
  }, [data, isLoaded]);

  // Apply Theme Effect
  useEffect(() => {
      if (isLoaded && data.settings.themeColor) {
          applyTheme(data.settings.themeColor);
      } else if (isLoaded) {
          applyTheme('pine'); 
      }
  }, [data.settings.themeColor, isLoaded]);

  // Update pomodoro timer if settings change (and not currently active)
  useEffect(() => {
      if (!isPomodoroActive && data.settings.pomodoroDuration) {
          setPomodoroLeft(data.settings.pomodoroDuration * 60);
      }
  }, [data.settings.pomodoroDuration, isPomodoroActive]);

  // Pomodoro Timer
  useEffect(() => {
    let interval: any;
    if (isPomodoroActive && pomodoroLeft > 0) {
      interval = setInterval(() => {
        setPomodoroLeft((prev) => prev - 1);
        // Add minute stats approx every 60s
        const maxTime = (data.settings.pomodoroDuration || 25) * 60;
        if (pomodoroLeft < maxTime && pomodoroLeft % 60 === 0) {
           setData(prev => ({
             ...prev,
             focusStats: { ...prev.focusStats, minutes: prev.focusStats.minutes + 1 }
           }));
        }
      }, 1000);
    } else if (pomodoroLeft === 0) {
      setIsPomodoroActive(false);
      const resetTime = (data.settings.pomodoroDuration || 25) * 60;
      setPomodoroLeft(resetTime); 
      // Add final minute
      setData(prev => ({
         ...prev,
         focusStats: { ...prev.focusStats, minutes: prev.focusStats.minutes + 1 }
      }));
      // Could play a sound here
    }
    return () => clearInterval(interval);
  }, [isPomodoroActive, pomodoroLeft, data.settings.pomodoroDuration]);

  const togglePomodoro = () => {
    setIsPomodoroActive(!isPomodoroActive);
  };

  // Helper: Create Date from HH:MM string relative to today
  const getDateFromTimeStr = useCallback((timeStr: string, now: Date) => {
    if (!timeStr) return new Date(now);
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  }, []);

  // Advanced Salary Calculation (Lunch + Mental Victory)
  const calculateEarnings = useCallback(() => {
    const { settings } = data;
    if (!settings.monthlySalary) return 0;

    const now = new Date();
    const startTime = getDateFromTimeStr(settings.startTime, now);
    const endTime = getDateFromTimeStr(settings.endTime, now);
    const lunchStart = getDateFromTimeStr(settings.lunchStartTime || "12:00", now);
    const lunchEnd = getDateFromTimeStr(settings.lunchEndTime || "13:30", now);

    if (now < startTime) return 0;

    // Rate Calculation: Based on CONTRACT hours (workingHoursPerDay)
    // We assume the salary is paid for the contract hours, regardless of the actual start/end time setting window
    // Standard Seconds/Month = Days * Hours * 3600
    const totalContractSecondsPerMonth = settings.workingDaysPerMonth * settings.workingHoursPerDay * 3600;
    const salaryPerSecond = settings.monthlySalary / totalContractSecondsPerMonth;

    // Calculate worked seconds today
    let secondsWorked = 0;
    
    // Check if Mental Victory Mode is ON (Lunch counts as money)
    const mentalVictory = settings.mentalVictoryMode;

    const currentCalcTime = now > endTime ? endTime : now;
    
    // Total raw duration since start
    const rawDuration = (currentCalcTime.getTime() - startTime.getTime()) / 1000;

    if (mentalVictory) {
      // Simple logic: Money grows every second between start and end
      secondsWorked = Math.max(0, rawDuration);
    } else {
      // Complex logic: Exclude lunch break
      // 1. Morning Shift
      if (currentCalcTime < lunchStart) {
        secondsWorked = Math.max(0, rawDuration);
      } 
      // 2. During Lunch
      else if (currentCalcTime >= lunchStart && currentCalcTime < lunchEnd) {
        // You only get paid for the morning part
        secondsWorked = Math.max(0, (lunchStart.getTime() - startTime.getTime()) / 1000);
      } 
      // 3. Afternoon Shift (or finished)
      else {
         const morningSeconds = (lunchStart.getTime() - startTime.getTime()) / 1000;
         const afternoonSeconds = (currentCalcTime.getTime() - lunchEnd.getTime()) / 1000;
         secondsWorked = Math.max(0, morningSeconds + afternoonSeconds);
      }
    }
    
    return secondsWorked * salaryPerSecond;
  }, [data.settings, getDateFromTimeStr]);

  // Countdown Logic
  const updateCountdown = useCallback(() => {
    if (!data.settings.endTime) return;
    const now = new Date();
    const endTime = getDateFromTimeStr(data.settings.endTime, now);
    
    const diff = endTime.getTime() - now.getTime();
    
    if (diff > 0) {
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeUntilOffWork(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    } else {
      setTimeUntilOffWork("- " + translations[data.settings.language || 'zh'].overtime);
    }
  }, [data.settings.endTime, getDateFromTimeStr, data.settings.language]);

  // Main Loop
  const tick = useCallback(() => {
    setCurrentTime(new Date());
    setEarnedToday(calculateEarnings());
    updateCountdown();
    requestRef.current = requestAnimationFrame(tick);
  }, [calculateEarnings, updateCountdown]);

  useEffect(() => {
    if (!isLoaded) return;
    requestRef.current = requestAnimationFrame(tick);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isLoaded, tick]);

  // Task Handlers
  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText,
      completed: false,
      createdAt: Date.now()
    };
    setData(prev => ({ ...prev, tasks: [newTask, ...prev.tasks] }));
    setNewTaskText("");
  };

  const toggleTask = (id: string) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  const deleteTask = (id: string) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id)
    }));
  };

  const setPurchasingTarget = (id: string) => {
    setData(prev => ({ ...prev, settings: { ...prev.settings, purchasingTargetId: id } }));
  };

  const handleClockOut = () => {
    // Check for custom quote
    if (data.settings.customQuote && data.settings.customQuote.trim() !== "") {
        setQuote(data.settings.customQuote);
    } else {
        // Pick a random quote
        const quotes = translations[data.settings.language || 'zh'].quotes;
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        setQuote(randomQuote);
    }
    setIsReportOpen(true);
  };

  if (!isLoaded) return null;

  const { settings, tasks } = data;
  const t = translations[settings.language || 'zh'];
  const locale = settings.language === 'zh' ? 'zh-CN' : 'en-US';
  
  // Resolve purchasing item
  const purchasingItems = settings.purchasingItems || [];
  const currentPurchasingItem = purchasingItems.find(i => i.id === settings.purchasingTargetId) || purchasingItems[0];
  // Fallback if list is empty for some reason
  const displayItem = currentPurchasingItem || { name: '?', price: 1, emoji: '❓' };
  
  const purchasingCount = (earnedToday / (displayItem.price || 1)).toFixed(1);

  // Format Helpers
  const formatMoney = (amount: number) => amount.toFixed(4);
  const formatTime = (date: Date) => date.toLocaleTimeString(locale, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (date: Date) => date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const formatPomodoro = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Background
  const bgStyle = settings.backgroundImage
    ? { backgroundImage: `url(${settings.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: getThemeGradient(settings.themeColor || 'pine') };

  const getProgress = () => {
     const now = new Date();
     const start = getDateFromTimeStr(settings.startTime, now).getTime();
     const end = getDateFromTimeStr(settings.endTime, now).getTime();
     const current = now.getTime();
     if (current < start) return 0;
     if (current > end) return 100;
     return Math.min(100, Math.max(0, ((current - start) / (end - start)) * 100));
  };

// 在 App 组件内部
const handleWindowControl = (action: 'minimize' | 'close') => {
  try {
    // @ts-ignore
    if (window.require) {
      // @ts-ignore
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('window-control', action);
    }
  } catch(e) {}
};

// MINI MODE RENDER (纯净悬浮胶囊版)
  if (isMiniMode) {
    const progress = getProgress();
    return (
      // 1. 外层完全透明，不设背景色
      <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-visible">
        
        {/* 2. 这里的 div 是胶囊本体，加上 drag-region 允许拖拽 */}
        <div className="relative overflow-hidden glass-panel p-4 pr-6 rounded-full shadow-2xl flex items-center gap-6 border border-white/50 bg-white/90 backdrop-blur-xl hover:scale-105 transition-transform duration-300 drag-region group">
             
             {/* 进度条背景 */}
             <div 
                className="absolute inset-0 bg-primary-500/10 z-0 transition-all duration-1000 linear"
                style={{ width: `${progress}%` }}
             ></div>

             <div className="relative z-10 flex items-center gap-6">
                {/* 倒计时 */}
                <div className="flex flex-col items-center select-none">
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">{t.offWorkIn}</span>
                  <span className="text-xl font-mono font-bold text-primary-900 leading-none mt-1">{timeUntilOffWork}</span>
                </div>

                <div className="w-px h-8 bg-primary-200"></div>

                {/* 收入 */}
                <div className="flex flex-col items-center min-w-[100px] select-none">
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">{t.earnedToday}</span>
                  <span className="text-xl font-mono font-bold text-primary-900 leading-none mt-1">
                    {settings.currencySymbol}{formatMoney(earnedToday)}
                  </span>
                </div>

                {/* 展开按钮 (加上 no-drag 否则点不动) */}
                <button 
                  onClick={() => setIsMiniMode(false)}
                  className="ml-2 p-2 bg-white/50 hover:bg-white rounded-full text-primary-600 transition-colors no-drag shadow-sm"
                  title={t.expand}
                >
                    <MaximizeIcon className="w-5 h-5" />
                </button>
             </div>
        </div>
      </div>
    );
  }

  // FULL MODE RENDER
  return (
    <div className="relative w-full h-screen flex items-center justify-center p-4 transition-all duration-500" style={bgStyle}>
  {/* 👇👇👇 新增：自定义标题栏 (解决无边框后无法关闭的问题) 👇👇👇 */}
      <div className="absolute top-0 left-0 w-full h-10 flex justify-end items-center px-4 z-50">
         {/* 整个顶部作为拖拽区 */}
         <div className="absolute inset-0 drag-region"></div>
         
         {/* 按钮区 */}
         <div className="flex gap-2 relative z-10 no-drag">
            <button onClick={() => handleWindowControl('minimize')} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-primary-900 transition-colors">
               <span className="font-bold mb-2">_</span>
            </button>
            <button onClick={() => handleWindowControl('close')} className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500 hover:text-white text-primary-900 transition-colors">
               <XIcon className="w-4 h-4" />
            </button>
         </div>
      </div>
      {/* 👆👆👆 标题栏结束 👆👆👆 */}
  
  
      {settings.backgroundImage && <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]"></div>}
      
      {/* Top Buttons */}
      {/* 旧版右上角悬浮按钮 */}
      {/* <div className="absolute top-8 right-4 z-20 flex gap-3">
         <button 
            onClick={handleClockOut}
            className="p-3 glass-panel rounded-full text-primary-700 bg-white/40 hover:bg-white/80 transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2 group"
         >
             <LogOutIcon className="w-5 h-5" />
             <span className="text-sm font-bold hidden md:block">{t.clockOut}</span>
         </button>
         <button 
            onClick={() => setIsMiniMode(true)}
            className="p-3 glass-panel rounded-full text-primary-700 hover:bg-white/60 transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2 group"
         >
            <span className="text-sm font-semibold max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap opacity-0 group-hover:opacity-100">{t.miniMode}</span>
            <MinimizeIcon className="w-5 h-5" />
         </button>
      </div> */}

      <div className="relative w-full max-w-5xl h-[90vh] grid grid-cols-1 md:grid-cols-12 gap-6 z-10">
        
        {/* Left Panel: Dashboard */}
        <div className="md:col-span-7 flex flex-col gap-6">
          
          {/* Header Card */}
          <div className="glass-panel p-8 rounded-[2.5rem] shadow-xl shadow-primary-900/5 flex flex-col justify-between min-h-[300px] relative overflow-hidden group bg-white/60 backdrop-blur-xl border-white/40">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
<div className="flex justify-between items-start z-10">
              {/* 左侧：问候语 (保持不变) */}
              <div>
                <h1 className="text-3xl font-bold text-primary-900 mb-1">
                  {t.hello}, {settings.userName}
                </h1>
                <p className="text-primary-700 opacity-80 flex items-center gap-2">
                   <ClockIcon className="w-4 h-4" />
                   {formatDate(currentTime)}
                </p>
              </div>

              {/* 👇👇👇 右侧：设置 + 灵动展开胶囊 👇👇👇 */}
              <div className="flex items-center gap-3">
                
                {/* 🌟 灵动胶囊：平时只显示 Mini，悬停时展开显示打卡 */}
                <div className="flex items-center bg-white/40 hover:bg-white backdrop-blur-md rounded-full p-1 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-sm border border-white/20 group hover:pr-4 hover:shadow-md">
                    
                    {/* 1. 迷你模式按钮 (常驻触发器) */}
                    <button 
                      onClick={() => setIsMiniMode(true)} 
                      className="p-2 rounded-full text-primary-800 hover:bg-primary-100 transition-colors relative z-10"
                      title={t.miniMode}
                    >
                       <MinimizeIcon className="w-6 h-6" />
                    </button>

                    {/* 2. 下班打卡按钮 (隐藏的内容 - 悬停展开) */}
                    <div className="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden flex items-center">
                        {/* 分割线 */}
                        <div className="w-px h-4 bg-primary-900/10 mx-2 flex-shrink-0"></div>
                        
                        <button 
                          onClick={handleClockOut} 
                          className="flex items-center gap-1 text-sm font-bold text-primary-700 hover:text-red-500 whitespace-nowrap transition-colors pr-1"
                        >
                           <LogOutIcon className="w-4 h-4" />
                           <span>{t.clockOut}</span>
                        </button>
                    </div>

                </div>

                {/* 3. 设置按钮 (独立在旁边) */}
                <button 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="p-3 bg-white/40 hover:bg-white rounded-2xl transition-all shadow-sm text-primary-800 backdrop-blur-md"
                >
                  <SettingsIcon className="w-6 h-6" />
                </button>
              </div>
              {/* 👆👆👆 修改结束 👆👆👆 */}
            </div>

            <div className="z-10 flex flex-col items-center justify-center flex-grow py-8">
              <div className="text-7xl font-bold font-mono tracking-tight text-primary-900 drop-shadow-sm">
                {formatTime(currentTime)}
              </div>
              <div className="mt-4 flex flex-col items-center gap-1">
                 <div className="text-sm font-bold text-primary-600 uppercase tracking-widest opacity-80">{t.offWorkIn}</div>
                 <div className="text-2xl font-mono font-bold text-primary-800">
                    {timeUntilOffWork}
                 </div>
              </div>
            </div>
          </div>

          {/* Earnings Card */}
          <div className="glass-panel p-8 rounded-[2.5rem] shadow-xl shadow-primary-900/5 flex-grow flex flex-col justify-center relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/40 group">
             
             {/* Focus Mode Overlay - Transitioned */}
             <div 
                className={`absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/30 backdrop-blur-xl transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    isPomodoroActive 
                    ? 'opacity-100 visible translate-y-0 scale-100' 
                    : 'opacity-0 invisible translate-y-8 scale-95'
                }`}
             >
                  <div className={`flex flex-col items-center transition-all duration-700 delay-100 ${isPomodoroActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                      <div className="p-4 bg-primary-100 rounded-3xl mb-2 shadow-inner text-primary-600 ring-4 ring-white/50">
                         <ZapIcon className="w-14 h-14" />
                      </div>
                      <h2 className="text-3xl font-black text-primary-900 tracking-tight mb-2">{t.focusing}</h2>
                      <p className="text-primary-600 font-mono text-2xl font-bold tracking-widest">{formatPomodoro(pomodoroLeft)}</p>
                      
                      <button 
                        onClick={togglePomodoro}
                        className="mt-8 px-10 py-4 bg-primary-900 hover:bg-primary-800 text-white font-bold rounded-2xl shadow-xl shadow-primary-900/20 transition-all active:scale-95 hover:-translate-y-1"
                      >
                        {t.stopFocus}
                      </button>
                  </div>
             </div>

             {/* Normal Content - Transitioned */}
             <div className={`relative z-10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPomodoroActive ? 'blur-sm grayscale opacity-30 scale-95' : 'opacity-100 scale-100'}`}>
               <div className="flex items-center gap-3 mb-2 text-primary-800 opacity-80">
                  <BriefcaseIcon className="w-5 h-5" />
                  <span className="font-bold tracking-wide uppercase text-sm">{t.earnedToday}</span>
               </div>
               
               <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary-800">{settings.currencySymbol}</span>
                  <span className="text-6xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-800 to-primary-600 tabular-nums tracking-tighter">
                    {formatMoney(earnedToday)}
                  </span>
               </div>
                
               {/* Purchasing Power Display */}
               <div className="mt-4 flex items-center gap-4">
                   <div className="flex gap-1 p-1 bg-white/50 rounded-xl overflow-x-auto max-w-[200px] md:max-w-[300px] custom-scrollbar">
                      {purchasingItems.map(item => (
                          <button
                             key={item.id}
                             onClick={() => setPurchasingTarget(item.id)}
                             className={`p-2 rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${settings.purchasingTargetId === item.id ? 'bg-primary-100 text-primary-700 shadow-sm scale-105' : 'text-primary-400 hover:bg-primary-50'}`}
                             title={`${item.name} (${settings.currencySymbol}${item.price})`}
                          >
                             <span className="text-lg">{item.emoji}</span>
                          </button>
                      ))}
                   </div>
                   <div className="text-sm font-semibold text-primary-700 flex items-center gap-2">
                       <span className="opacity-70 hidden md:inline">{t.earned_prefix}:</span>
                       <span className="bg-primary-100/50 px-2 py-1 rounded-lg border border-primary-200/50 whitespace-nowrap">
                           {purchasingCount} {displayItem.name}
                       </span>
                   </div>
               </div>

                {/* Progress Bar */}
               <div className="mt-6">
                 <div className="h-4 w-full bg-primary-100/50 rounded-full overflow-hidden shadow-inner border border-primary-200/30">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-1000 ease-linear shadow-lg"
                      style={{ width: `${getProgress()}%` }}
                    ></div>
                 </div>
               </div>
             </div>
          </div>

        </div>

        {/* Right Panel: Todo & Pomodoro */}
        <div className="md:col-span-5 h-full flex flex-col gap-6">
           
           {/* Pomodoro Widget */}
           {!isPomodoroActive && (
             <div className="glass-panel p-6 rounded-[2rem] bg-white/60 backdrop-blur-xl border-white/40 flex items-center justify-between shadow-lg shadow-primary-900/5 animate-[fadeIn_0.5s]">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-primary-100 rounded-2xl text-primary-600">
                      <ZapIcon className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="font-bold text-primary-900">{t.focusMode}</h3>
                      <p className="text-xs text-primary-600 font-medium opacity-70">
                        {settings.pomodoroDuration || 25} {t.unit_mins} timer
                      </p>
                   </div>
                </div>
                <button 
                  onClick={togglePomodoro}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-primary-200 active:scale-95"
                >
                   {t.startFocus}
                </button>
             </div>
           )}

           {/* Todo List */}
           <div className="glass-panel flex-grow rounded-[2.5rem] shadow-xl shadow-primary-900/5 flex flex-col overflow-hidden relative bg-white/60 backdrop-blur-xl border-white/40">
              <div className="p-6 pb-2 border-b border-primary-100/50 bg-white/30 backdrop-blur-md z-10">
                <h2 className="text-xl font-bold text-primary-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-6 bg-primary-500 rounded-full"></span>
                  {t.todaysMission}
                </h2>
                <form onSubmit={addTask} className="relative">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder={t.addTaskPlaceholder}
                    className="w-full pl-5 pr-12 py-4 bg-white/50 border-none rounded-2xl text-primary-900 placeholder-primary-900/40 focus:ring-2 focus:ring-primary-400 focus:bg-white transition-all shadow-sm"
                  />
                  <button 
                    type="submit"
                    disabled={!newTaskText.trim()}
                    className="absolute right-2 top-2 bottom-2 aspect-square bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-600 text-white rounded-xl flex items-center justify-center transition-all"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {tasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-primary-800/40">
                    <div className="w-16 h-16 rounded-3xl border-4 border-dashed border-primary-200 mb-4 flex items-center justify-center">
                       <CheckCircleIcon className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-semibold">{t.allClear}</p>
                  </div>
                ) : (
                  tasks.map(task => (
                    <div 
                      key={task.id}
                      className={`group flex items-center gap-3 p-4 rounded-2xl transition-all duration-200 ${
                        task.completed 
                          ? 'bg-primary-50/50 opacity-60' 
                          : 'bg-white/50 hover:bg-white shadow-sm hover:shadow-md hover:translate-x-1'
                      }`}
                    >
                      <button 
                        onClick={() => toggleTask(task.id)}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          task.completed ? 'bg-primary-500 border-primary-500' : 'border-primary-300 hover:border-primary-500'
                        }`}
                      >
                         <CheckCircleIcon className={`w-4 h-4 text-white transition-transform ${task.completed ? 'scale-100' : 'scale-0'}`} checked={true} />
                      </button>
                      
                      <span className={`flex-grow text-primary-900 font-medium truncate ${task.completed ? 'line-through text-primary-900/50' : ''}`}>
                        {task.text}
                      </span>

                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
           </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => setData(prev => ({ ...prev, settings: newSettings }))}
      />
      
      {/* Report Modal - Unified Transition */}
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ${isReportOpen ? 'visible' : 'invisible pointer-events-none'}`}
      >
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isReportOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={() => setIsReportOpen(false)}
            ></div>

            {/* Modal Content */}
            <div 
                className={`relative w-full max-w-md bg-gradient-to-br from-primary-50 to-white rounded-3xl shadow-2xl overflow-hidden border border-white/40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isReportOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
            >
                {/* Close Button */}
                <button 
                    onClick={() => setIsReportOpen(false)}
                    className="absolute top-4 right-4 p-2 bg-black/5 hover:bg-black/10 rounded-full z-20"
                >
                    <XIcon className="w-5 h-5 text-primary-900" />
                </button>

                {/* Content */}
                <div className="p-8 text-center relative">
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary-200/50 to-transparent"></div>
                    
                    <h2 className="text-2xl font-black text-primary-900 mb-2 relative z-10">{t.dailyReport}</h2>
                    <p className="text-primary-600 font-medium mb-8 relative z-10">{formatDate(currentTime)}</p>

                    <div className="space-y-6 relative z-10">
                         {/* Money */}
                        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white shadow-sm">
                            <div className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-1">{t.totalEarned}</div>
                            <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-700 to-primary-500">
                                {settings.currencySymbol}{Math.floor(earnedToday)}
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white shadow-sm">
                                <div className="text-xs font-bold text-primary-600 uppercase mb-1">{t.focusTime}</div>
                                <div className="text-2xl font-bold text-primary-800">
                                    {data.focusStats.minutes} <span className="text-sm font-medium">{t.unit_mins}</span>
                                </div>
                            </div>
                            <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white shadow-sm">
                                <div className="text-xs font-bold text-primary-600 uppercase mb-1">{t.trophies}</div>
                                <div className="text-lg font-bold text-primary-800 flex items-center justify-center gap-1">
                                    <span className="text-2xl">{displayItem.emoji}</span>
                                    <span>x {purchasingCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quote */}
                        <div className="mt-8 pt-6 border-t border-primary-100">
                            <p className="text-primary-800 font-serif italic text-lg leading-relaxed whitespace-pre-wrap">
                                "{quote}"
                            </p>
                        </div>
                    </div>
                </div>
            </div>
      </div>
    </div>
  );
}

export default App;