
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    SettingsIcon, CheckCircleIcon, PlusIcon, TrashIcon, BriefcaseIcon, ClockIcon,
    MaximizeIcon, MinimizeIcon, ZapIcon, LogOutIcon, XIcon, EditIcon, HistoryIcon, RepeatIcon, CalendarIcon, CoinIcon, PinIcon
} from './components/Icons';
import SettingsModal from './components/SettingsModal';
import TaskHistoryModal from './components/TaskHistoryModal';
import FractalPine from './components/FractalPine'; // Import the new component
import { Task, AppData } from './types';
import { loadAppData, saveAppData } from './services/storageService';
import { translations } from './translations';
import { applyTheme, getThemeGradient } from './themes';

function App() {
    const [data, setData] = useState<AppData>({ settings: {} as any, tasks: [], focusStats: { date: '', minutes: 0 }, bonusStats: { date: '', amount: 0 } });
    const [isLoaded, setIsLoaded] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Earnings State
    const [earnedToday, setEarnedToday] = useState(0);
    const [earnedMonth, setEarnedMonth] = useState(0); // 新增：本月收入
    const [earningsMode, setEarningsMode] = useState<'daily' | 'monthly'>('daily'); // 新增：切换模式
    const [dailyTarget, setDailyTarget] = useState(1); // 新增：每日目标薪资，用于计算百分比

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [newTaskText, setNewTaskText] = useState("");
    const [timeUntilOffWork, setTimeUntilOffWork] = useState("");
    const [quote, setQuote] = useState("");
    const [daysUntilPayday, setDaysUntilPayday] = useState(0); // 新增：发薪日倒计时

    // Bonus/Windfall State
    const [isBonusInputOpen, setIsBonusInputOpen] = useState(false);
    const [bonusInputAmount, setBonusInputAmount] = useState("");
    // New: Floating animation for bonus
    const [bonusFloater, setBonusFloater] = useState<{ id: number, text: string } | null>(null);

    // Feature States
    const [isMiniMode, setIsMiniMode] = useState(false);
    // Removed Zen Mode State
    const [pomodoroLeft, setPomodoroLeft] = useState(25 * 60);
    const [isPomodoroActive, setIsPomodoroActive] = useState(false);

    // Editing State
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editInputText, setEditInputText] = useState("");

    // Refs
    const editInputRef = useRef<HTMLInputElement>(null);
    const bonusInputRef = useRef<HTMLInputElement>(null);
    const taskInputRef = useRef<HTMLInputElement>(null);
    const requestRef = useRef<number>(0);

    // 1. 初始化数据
    // Initialize
    useEffect(() => {
        const loadedData = loadAppData();
        const todayStr = new Date().toISOString().split('T')[0];

        // Check if focus stats need reset (new day)
        if (loadedData.focusStats?.date !== todayStr) {
            loadedData.focusStats = { date: todayStr, minutes: 0 };
        }
        // Check if bonus stats need reset
        if (loadedData.bonusStats?.date !== todayStr) {
            loadedData.bonusStats = { date: todayStr, amount: 0 };
        }

        // Set initial pomodoro duration
        const initialDuration = loadedData.settings.pomodoroDuration || 25;
        setPomodoroLeft(initialDuration * 60);

        // Calculate Daily Target (Prevent division by zero)
        const daily = (loadedData.settings.monthlySalary || 1) / (loadedData.settings.workingDaysPerMonth || 22);
        setDailyTarget(daily > 0 ? daily : 1);

        setData(loadedData);
        setIsLoaded(true);
    }, []);

    // Update daily target when settings change
    useEffect(() => {
        if (data.settings.monthlySalary) {
            const daily = (data.settings.monthlySalary || 1) / (data.settings.workingDaysPerMonth || 22);
            setDailyTarget(daily > 0 ? daily : 1);
        }
    }, [data.settings.monthlySalary, data.settings.workingDaysPerMonth]);

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
                    ipcRenderer.send('resize-window', { width: 380, height: 95, mini: true });
                } else {
                    ipcRenderer.send('resize-window', { width: 1000, height: 700, mini: false });
                }
            }
        } catch (e) {
            console.log('Browser mode (not electron), skipping resize');
        }
    }, [isMiniMode]);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Alt + N : Focus New Task Input
            if (e.altKey && e.code === 'KeyN') {
                e.preventDefault();
                taskInputRef.current?.focus();
            }
            // Alt + M : Toggle Mini Mode
            if (e.altKey && e.code === 'KeyM') {
                e.preventDefault();
                setIsMiniMode(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when editing starts
    useEffect(() => {
        if (editingTaskId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingTaskId]);

    // Focus bonus input
    useEffect(() => {
        if (isBonusInputOpen && bonusInputRef.current) {
            bonusInputRef.current.focus();
        }
    }, [isBonusInputOpen]);


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

    // --- Core Calculation Logic ---
    const calculateEarnings = useCallback(() => {
        const { settings } = data;
        if (!settings.monthlySalary) return { daily: 0, monthly: 0 };

        const now = new Date();
        const startTime = getDateFromTimeStr(settings.startTime, now);
        const endTime = getDateFromTimeStr(settings.endTime, now);
        const lunchStart = getDateFromTimeStr(settings.lunchStartTime || "12:00", now);
        const lunchEnd = getDateFromTimeStr(settings.lunchEndTime || "13:30", now);

        // Rate Calculation
        const totalContractSecondsPerMonth = settings.workingDaysPerMonth * settings.workingHoursPerDay * 3600;
        const salaryPerSecond = settings.monthlySalary / totalContractSecondsPerMonth;
        const dailyContractSeconds = settings.workingHoursPerDay * 3600;

        // --- Daily Earnings ---
        let dailySecondsWorked = 0;

        if (now >= startTime) {
            const mentalVictory = settings.mentalVictoryMode;
            const currentCalcTime = now > endTime ? endTime : now;
            const rawDuration = (currentCalcTime.getTime() - startTime.getTime()) / 1000;

            if (mentalVictory) {
                dailySecondsWorked = Math.max(0, rawDuration);
            } else {
                if (currentCalcTime < lunchStart) {
                    dailySecondsWorked = Math.max(0, rawDuration);
                } else if (currentCalcTime >= lunchStart && currentCalcTime < lunchEnd) {
                    dailySecondsWorked = Math.max(0, (lunchStart.getTime() - startTime.getTime()) / 1000);
                } else {
                    const morningSeconds = (lunchStart.getTime() - startTime.getTime()) / 1000;
                    const afternoonSeconds = (currentCalcTime.getTime() - lunchEnd.getTime()) / 1000;
                    dailySecondsWorked = Math.max(0, morningSeconds + afternoonSeconds);
                }
            }
        }

        // --- Monthly Earnings ---
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();

        let pastWorkDays = 0;
        for (let d = 1; d < currentDay; d++) {
            const tempDate = new Date(currentYear, currentMonth, d);
            const dayOfWeek = tempDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                pastWorkDays++;
            }
        }

        const monthlySecondsWorked = (pastWorkDays * dailyContractSeconds) + dailySecondsWorked;

        // Add Bonus to earnings
        const dailyBonus = data.bonusStats?.amount || 0;

        return {
            daily: (dailySecondsWorked * salaryPerSecond) + dailyBonus,
            monthly: (monthlySecondsWorked * salaryPerSecond) + dailyBonus // Simplified monthly bonus logic (just adds today's)
        };
    }, [data.settings, data.bonusStats, getDateFromTimeStr]);

    // Countdown & Payday Logic
    const updateTiming = useCallback(() => {
        const { settings } = data;
        const now = new Date();

        // 1. Off Work Countdown
        if (settings.endTime) {
            const endTime = getDateFromTimeStr(settings.endTime, now);
            const diff = endTime.getTime() - now.getTime();

            if (diff > 0) {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeUntilOffWork(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            } else {
                setTimeUntilOffWork("- " + translations[settings.language || 'zh'].overtime);
            }
        }

        // 2. Payday Countdown
        const payday = settings.payday || 15; // Default 15th
        let targetPayday = new Date(now.getFullYear(), now.getMonth(), payday);

        // If we passed payday this month, target next month
        if (now.getDate() > payday) {
            targetPayday = new Date(now.getFullYear(), now.getMonth() + 1, payday);
        } else if (now.getDate() === payday) {
            // Even if it's payday today, we check if it's "now"
            setDaysUntilPayday(0);
            return;
        }

        const dayDiff = Math.ceil((targetPayday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setDaysUntilPayday(dayDiff);

    }, [data.settings, getDateFromTimeStr]);

    // Main Loop
    const tick = useCallback(() => {
        setCurrentTime(new Date());
        const earnings = calculateEarnings();
        setEarnedToday(earnings.daily);
        setEarnedMonth(earnings.monthly);
        updateTiming();
        requestRef.current = requestAnimationFrame(tick);
    }, [calculateEarnings, updateTiming]);

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
            createdAt: Date.now(),
            deleted: false,
            isPinned: false
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

    const togglePinTask = (id: string) => {
        setData(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.id === id ? { ...t, isPinned: !t.isPinned } : t)
        }));
    };

    const deleteTask = (id: string) => {
        // 软删除
        setData(prev => ({
            ...prev,
            tasks: prev.tasks.map(t => t.id === id ? { ...t, deleted: true } : t)
        }));
    };

    // 新增：永久删除（从历史记录中移除）
    const permanentDeleteTask = (id: string) => {
        setData(prev => ({
            ...prev,
            tasks: prev.tasks.filter(t => t.id !== id)
        }));
    };

    const handleImportData = (newData: AppData) => {
        setData(newData);
    };

    const handleAddBonus = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(bonusInputAmount);
        if (isNaN(amount) || amount <= 0) return;

        // 1. Update Data
        setData(prev => ({
            ...prev,
            bonusStats: {
                ...prev.bonusStats!,
                amount: (prev.bonusStats?.amount || 0) + amount
            }
        }));

        // 2. Trigger Float Animation
        setBonusFloater({ id: Date.now(), text: `+${amount}` });
        setTimeout(() => setBonusFloater(null), 1000); // Remove after 1s

        setBonusInputAmount("");
        setIsBonusInputOpen(false);
    };

    // Editing Handlers
    const startEditing = (task: Task) => {
        setEditingTaskId(task.id);
        setEditInputText(task.text);
    };

    const saveEdit = () => {
        if (editingTaskId && editInputText.trim()) {
            setData(prev => ({
                ...prev,
                tasks: prev.tasks.map(t => t.id === editingTaskId ? { ...t, text: editInputText } : t)
            }));
        }
        setEditingTaskId(null);
        setEditInputText("");
    };

    const cancelEdit = () => {
        setEditingTaskId(null);
        setEditInputText("");
    };

    const setPurchasingTarget = (id: string) => {
        setData(prev => ({ ...prev, settings: { ...prev.settings, purchasingTargetId: id } }));
    };

    const handleClockOut = () => {
        if (data.settings.customQuote && data.settings.customQuote.trim() !== "") {
            setQuote(data.settings.customQuote);
        } else {
            const quotes = translations[data.settings.language || 'zh'].quotes;
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            setQuote(randomQuote);
        }
        setIsReportOpen(true);
    };

    const toggleEarningsMode = () => {
        setEarningsMode(prev => prev === 'daily' ? 'monthly' : 'daily');
    };

    // --- Dynamic Atmosphere Logic ---
    const getAtmosphereStyle = () => {
        const hour = currentTime.getHours();
        // Morning (6-11): Bright, fresh
        if (hour >= 6 && hour < 12) {
            return { backgroundColor: 'rgba(255, 255, 255, 0.1)', mixBlendMode: 'overlay' as any };
        }
        // Afternoon (12-17): Warm, golden
        else if (hour >= 12 && hour < 18) {
            return { backgroundColor: 'rgba(255, 200, 100, 0.05)', mixBlendMode: 'multiply' as any };
        }
        // Evening/Night (18-5): Darker, cool, makes fireflies pop
        else {
            return { backgroundColor: 'rgba(10, 20, 40, 0.4)', mixBlendMode: 'multiply' as any };
        }
    };

    // --- BUG FIX: Calculate progress directly (no memo) to fix toggle sticky issue ---
    // Previously, useMemo was holding onto stale values or not updating fast enough during the toggle render cycle.
    const calculateProgress = () => {
        const now = currentTime;
        const { settings } = data;

        if (earningsMode === 'daily') {
            const start = getDateFromTimeStr(settings.startTime, now).getTime();
            const end = getDateFromTimeStr(settings.endTime, now).getTime();
            const current = now.getTime();

            let timeProgress = 0;
            if (end > start) {
                if (current > start) {
                    timeProgress = Math.min(100, Math.max(0, ((current - start) / (end - start)) * 100));
                }
            }
            const moneyProgress = dailyTarget > 0 ? Math.min(100, (earnedToday / dailyTarget) * 100) : 0;
            return Math.max(timeProgress, moneyProgress);
        } else {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const currentDay = now.getDate();
            return Math.min(100, Math.max(0, (currentDay / daysInMonth) * 100));
        }
    };

    const progressPercent = calculateProgress();


    if (!isLoaded) return null;

    const { settings, tasks } = data;
    const visibleTasks = tasks.filter(t => !t.deleted);

    // Sort tasks: Pinned first, then by creation time
    visibleTasks.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt - a.createdAt;
    });

    const t = translations[settings.language || 'zh'];
    const locale = settings.language === 'zh' ? 'zh-CN' : 'en-US';

    const purchasingItems = settings.purchasingItems || [];
    const currentPurchasingItem = purchasingItems.find(i => i.id === settings.purchasingTargetId) || purchasingItems[0];
    const displayItem = currentPurchasingItem || { name: '?', price: 1, emoji: '❓' };

    const displayAmount = earningsMode === 'daily' ? earnedToday : earnedMonth;
    const purchasingCount = (displayAmount / (displayItem.price || 1)).toFixed(1);

    const formatMoney = (amount: number) => amount.toFixed(4);
    const formatTime = (date: Date) => date.toLocaleTimeString(locale, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatDate = (date: Date) => date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
    const formatPomodoro = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const bgStyle = settings.backgroundImage
        ? { backgroundImage: `url(${settings.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: getThemeGradient(settings.themeColor || 'pine') };

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

// MINI MODE RENDER
    if (isMiniMode) {
        return (
            <div className="relative w-full h-full flex items-center justify-center bg-transparent">
                {/* Removed outer background elements to prevent rectangular box shadow */}
                {/* Removed overflow-hidden from outer container to prevent clipping of CSS shadows */}

                {/* Removed shadow-2xl and hover:scale-105 to eliminate external artifacts */}
                <div className="relative overflow-hidden glass-panel p-4 pr-6 rounded-full flex items-center gap-6 border border-white/60 bg-white/90 backdrop-blur-xl transition-transform duration-300 drag-region group z-10">
                    {/* Inner Backgrounds: Clipped to rounded-full */}
                    <div className="bg-noise !absolute !inset-0"></div>
                    <div className="absolute inset-0 pointer-events-none transition-colors duration-[3000ms]" style={getAtmosphereStyle()}></div>

                    <div
                        className="absolute inset-0 bg-primary-500/10 z-0 transition-all duration-1000 linear"
                        style={{ width: `${progressPercent}%` }}
                    ></div>

                    <div className="relative z-10 flex items-center gap-6">
                        <div className="flex flex-col items-center select-none">
                            <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">{t.offWorkIn}</span>
                            <span className="text-xl font-mono font-bold text-primary-900 leading-none mt-1">{timeUntilOffWork}</span>
                        </div>
                        <div className="w-px h-8 bg-primary-200"></div>
                        <div className="flex flex-col items-center min-w-[100px] select-none">
                            <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">{t.earnedToday}</span>
                            <span className="text-xl font-mono font-bold text-primary-900 leading-none mt-1">
                    {settings.currencySymbol}{formatMoney(earnedToday)}
                  </span>
                        </div>
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
        <div className="relative w-full h-screen flex items-center justify-center p-4 transition-all duration-[2000ms]" style={bgStyle}>

            {/* 2. 添加噪点纹理层 */}
            <div className="bg-noise"></div>

            {/* 2.1 动态时间光照层 (Atmosphere Layer) */}
            <div className="absolute inset-0 pointer-events-none transition-colors duration-[5000ms] z-0" style={getAtmosphereStyle()}></div>

            <div className="absolute top-0 left-0 w-full h-10 flex justify-end items-center px-4 z-50">
                <div className="absolute inset-0 drag-region"></div>
                <div className="flex gap-2 relative z-10 no-drag">
                    <button onClick={() => handleWindowControl('minimize')} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 text-primary-900 transition-colors">
                        <span className="font-bold mb-2">_</span>
                    </button>
                    <button onClick={() => handleWindowControl('close')} className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500 hover:text-white text-primary-900 transition-colors">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {settings.backgroundImage && <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]"></div>}

            {/* 3. 修改主容器布局 */}
            <div className="relative w-full max-w-5xl h-[90vh] grid grid-cols-1 md:grid-cols-12 gap-6 z-10">

                {/* Left Panel: Dashboard */}
                <div className="md:col-span-7 flex flex-col gap-6 min-h-0 transition-all duration-700">

                    {/* Header Card */}
                    <div className="glass-panel p-8 rounded-[2.5rem] shadow-xl shadow-primary-900/5 flex flex-col justify-between min-h-[300px] relative overflow-hidden group bg-white/60 backdrop-blur-xl border-white/40 flex-shrink-0 transition-all duration-500">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <h1 className="text-3xl font-bold text-primary-900 mb-1">
                                    {t.hello}, {settings.userName}
                                </h1>
                                <p className="text-primary-700 opacity-80 flex items-center gap-2">
                                    <ClockIcon className="w-4 h-4" />
                                    {formatDate(currentTime)}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">

                                <div className="flex items-center bg-white/40 hover:bg-white backdrop-blur-md rounded-full p-1 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-sm border border-white/20 group hover:pr-4 hover:shadow-md">
                                    <button
                                        onClick={() => setIsMiniMode(true)}
                                        className="p-2 rounded-full text-primary-800 hover:bg-primary-100 transition-colors relative z-10"
                                        title={`${t.miniMode} (Alt+M)`}
                                    >
                                        <MinimizeIcon className="w-6 h-6" />
                                    </button>
                                    <div className="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden flex items-center">
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
                                <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="p-3 bg-white/40 hover:bg-white rounded-2xl transition-all shadow-sm text-primary-800 backdrop-blur-md"
                                >
                                    <SettingsIcon className="w-6 h-6" />
                                </button>
                            </div>
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
                    <div className="glass-panel p-8 rounded-[2.5rem] shadow-xl shadow-primary-900/5 flex-grow flex flex-col justify-center relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/40 group min-h-0 transition-all duration-700">

                        {/* Dynamic Pine Tree Background */}
                        <div className="absolute bottom-0 right-0 pointer-events-none z-0 mix-blend-multiply transition-all duration-1000 opacity-20 group-hover:opacity-30">
                            <FractalPine
                                progress={progressPercent / 100} // Convert to 0-1 for FractalPine
                                width={300}
                                height={300}
                                theme={settings.themeColor}
                                showTree={settings.showTree ?? true}
                                showParticles={settings.showParticles ?? true}
                            />
                        </div>

                        {/* Focus Mode Overlay */}
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

                        {/* Normal Content */}
                        <div className={`relative z-10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPomodoroActive ? 'blur-sm grayscale opacity-30 scale-95' : 'opacity-100 scale-100'}`}>

                            {/* Toggle Header */}
                            <div className="flex items-center justify-between mb-2 text-primary-800 opacity-80">
                                <div className="flex items-center gap-3">
                                    {earningsMode === 'daily' ? <BriefcaseIcon className="w-5 h-5" /> : <CalendarIcon className="w-5 h-5" />}
                                    <span className="font-bold tracking-wide uppercase text-sm">
                        {earningsMode === 'daily' ? t.earnedToday : t.earnedMonth}
                    </span>
                                </div>
                                <button
                                    onClick={toggleEarningsMode}
                                    className="p-3 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all text-primary-600 shadow-sm border border-primary-100 active:scale-90 active:bg-primary-200"
                                    title={earningsMode === 'daily' ? t.toggleToMonthly : t.toggleToDaily}
                                >
                                    <RepeatIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 relative group/money">
                                <span className="text-4xl font-bold text-primary-800 flex-shrink-0">{settings.currencySymbol}</span>
                                <span key={earningsMode} className="text-6xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-800 to-primary-600 tabular-nums tracking-tighter animate-[fadeIn_0.3s] cursor-pointer" onClick={toggleEarningsMode}>
                    {formatMoney(displayAmount)}
                  </span>

                                {/* Floating Bonus Animation */}
                                {bonusFloater && (
                                    <div className="absolute left-full top-0 ml-2 animate-[floatUpFade_1s_ease-out_forwards] pointer-events-none whitespace-nowrap">
                                        <span className="text-2xl font-bold text-primary-600">{bonusFloater.text}</span>
                                    </div>
                                )}

                                {/* "Add Bonus" Button */}
                                {earningsMode === 'daily' && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsBonusInputOpen(!isBonusInputOpen)}
                                            className="ml-2 p-2 bg-primary-100/50 hover:bg-primary-100 text-primary-600 rounded-full transition-all opacity-0 group-hover/money:opacity-100 hover:scale-110 peer"
                                        >
                                            <CoinIcon className="w-5 h-5" />
                                        </button>

                                        {/* Hover Tooltip (Above) */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover/money:opacity-100 transition-opacity pointer-events-none">
                                            {t.addBonusHint}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                        </div>

                                        {/* Bonus Input Popup (Below) - More Compact */}
                                        <div
                                            className={`absolute top-full left-0 mt-3 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-3 border border-white/50 flex flex-col gap-2 transition-all origin-top-left z-20 ${isBonusInputOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
                                            style={{ width: '160px' }}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider">{t.extraIncome}</span>
                                                <button onClick={() => setIsBonusInputOpen(false)} className="text-gray-400 hover:text-gray-600"><XIcon className="w-3 h-3"/></button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    ref={bonusInputRef}
                                                    type="number"
                                                    placeholder="0"
                                                    className="w-full bg-transparent text-lg font-bold text-primary-900 border-b-2 border-primary-200 focus:border-primary-500 focus:outline-none py-0 placeholder-primary-200/70"
                                                    value={bonusInputAmount}
                                                    onChange={e => setBonusInputAmount(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleAddBonus(e)}
                                                />
                                                <button
                                                    onClick={handleAddBonus}
                                                    className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md shadow-primary-200 active:scale-95 transition-all"
                                                >
                                                    <PlusIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Daily: Purchasing Power / Monthly: Payday Countdown */}
                            {earningsMode === 'daily' ? (
                                <div className="mt-4 flex items-center gap-4 animate-[slideIn_0.3s]">
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
                            ) : (
                                <div className="mt-4 flex items-center gap-4 animate-[slideIn_0.3s]">
                                    <div className="p-3 bg-white/50 rounded-xl border border-primary-100">
                                        <CalendarIcon className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-primary-500 uppercase tracking-wider">{t.daysUntilPayday}</div>
                                        <div className="text-xl font-bold text-primary-800">
                                            {daysUntilPayday === 0 ? t.paydayArrived : `${daysUntilPayday} ${t.unit_days}`}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Progress Bar */}
                            <div className="mt-6">
                                <div className="h-4 w-full bg-primary-100/50 rounded-full overflow-hidden shadow-inner border border-primary-200/30">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-1000 ease-linear shadow-lg"
                                        style={{ width: `${progressPercent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Panel: Todo & Pomodoro */}
                <div className="md:col-span-5 h-full flex flex-col gap-6 min-h-0 transition-all duration-500">

                    {/* Pomodoro Widget */}
                    {!isPomodoroActive && (
                        <div className="glass-panel p-6 rounded-[2rem] bg-white/60 backdrop-blur-xl border-white/40 flex items-center justify-between shadow-lg shadow-primary-900/5 animate-[fadeIn_0.5s] flex-shrink-0">
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
                    <div className="glass-panel flex-grow min-h-0 rounded-[2.5rem] shadow-xl shadow-primary-900/5 flex flex-col overflow-hidden relative bg-white/60 backdrop-blur-xl border-white/40">
                        <div className="p-6 pb-2 border-b border-primary-100/50 bg-white/30 backdrop-blur-md z-10 flex-shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-primary-900 flex items-center gap-2">
                                    <span className="w-2 h-6 bg-primary-500 rounded-full"></span>
                                    {t.todaysMission}
                                </h2>
                                {/* 新增：任务历史按钮 */}
                                <button
                                    onClick={() => setIsHistoryOpen(true)}
                                    className="p-2 text-primary-500 hover:bg-primary-100 rounded-xl transition-colors"
                                    title={t.taskHistory}
                                >
                                    <HistoryIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={addTask} className="relative group">
                                <input
                                    ref={taskInputRef}
                                    type="text"
                                    value={newTaskText}
                                    onChange={(e) => setNewTaskText(e.target.value)}
                                    placeholder={`${t.addTaskPlaceholder} (Alt+N)`}
                                    className="w-full pl-5 pr-12 py-4 bg-white/60 border border-transparent rounded-2xl text-primary-900 placeholder-primary-800/50
                    focus:outline-none focus:bg-white focus:shadow-xl focus:shadow-primary-900/5 focus:ring-4 focus:ring-primary-100 focus:border-primary-300
                    transition-all duration-300 ease-out"
                                />
                                <button
                                    type="submit"
                                    disabled={!newTaskText.trim()}
                                    className="absolute right-2 top-2 bottom-2 aspect-square bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-600 text-white rounded-xl flex items-center justify-center transition-all shadow-sm hover:shadow-md"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                            </form>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {visibleTasks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-primary-800/40">
                                    <div className="w-16 h-16 rounded-3xl border-4 border-dashed border-primary-200 mb-4 flex items-center justify-center animate-breathe">
                                        <CheckCircleIcon className="w-8 h-8 opacity-50" />
                                    </div>
                                    <p className="font-semibold animate-pulse">{t.allClear}</p>
                                </div>
                            ) : (
                                visibleTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className={`group flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 ease-out active:scale-[0.98] ${
                                            task.completed
                                                ? 'bg-primary-50/50 opacity-60'
                                                : 'bg-white/50 hover:bg-white shadow-sm hover:shadow-md hover:translate-x-1'
                                        } ${task.isPinned ? 'border-l-4 border-primary-500' : ''}`}
                                    >
                                        <button
                                            onClick={() => toggleTask(task.id)}
                                            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                task.completed ? 'bg-primary-500 border-primary-500' : 'border-primary-300 hover:border-primary-500'
                                            }`}
                                        >
                                            <CheckCircleIcon className={`w-4 h-4 text-white transition-transform duration-300 ${task.completed ? 'scale-100' : 'scale-0'}`} checked={true} />
                                        </button>

                                        {/* Editing Logic */}
                                        {editingTaskId === task.id ? (
                                            <input
                                                ref={editInputRef}
                                                type="text"
                                                className="flex-grow bg-white border border-primary-300 rounded-lg px-2 py-1 text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                                                value={editInputText}
                                                onChange={(e) => setEditInputText(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                            />
                                        ) : (
                                            <div className="flex-grow min-w-0 flex items-center">
                            <span
                                onDoubleClick={() => startEditing(task)}
                                className={`relative inline-block max-w-full truncate text-primary-900 font-medium cursor-pointer transition-all duration-300 ${
                                    task.completed
                                        ? 'text-primary-900/40'
                                        : ''
                                }`}
                                title={task.text}
                            >
                                {/* Strikethrough Animation Line (Only over text) */}
                                <span
                                    className={`absolute left-0 top-1/2 h-0.5 bg-primary-800 transition-all duration-500 ease-out z-10 pointer-events-none ${task.completed ? 'w-full opacity-100' : 'w-0 opacity-0'}`}
                                ></span>
                                {task.text}
                            </span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Pin Button (New) */}
                                            {!task.completed && (
                                                <button
                                                    onClick={() => togglePinTask(task.id)}
                                                    className={`p-2 rounded-xl transition-all ${task.isPinned ? 'text-primary-600 bg-primary-100' : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'}`}
                                                    title="Pin Task"
                                                >
                                                    <PinIcon className="w-4 h-4" filled={task.isPinned} />
                                                </button>
                                            )}

                                            {/* Edit Button */}
                                            {editingTaskId !== task.id && !task.completed && (
                                                <button
                                                    onClick={() => startEditing(task)}
                                                    className="p-2 text-primary-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                                                    title={t.editTask}
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            {/* Delete Button (Soft Delete) */}
                                            <button
                                                onClick={() => deleteTask(task.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
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
                fullData={data} // Pass full data for export
                onSave={(newSettings) => setData(prev => ({ ...prev, settings: newSettings }))}
                onImport={handleImportData} // Pass import handler
            />

            <TaskHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                tasks={tasks}
                language={settings.language}
                onDeletePermanent={permanentDeleteTask}
            />

            {/* Report Modal */}
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
