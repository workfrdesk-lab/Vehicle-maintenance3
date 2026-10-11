/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { AppConfig, MaintenanceCard } from "./types";
import CheckInForm from "./components/CheckInForm";
import MaintenanceForm from "./components/MaintenanceForm";
import CheckOutForm from "./components/CheckOutForm";
import ReportArchive from "./components/ReportArchive";
import TemplateDesigner from "./components/TemplateDesigner";
import ListsManager from "./components/ListsManager";
import ReplacedPartsList from "./components/ReplacedPartsList";

import { 
  Wrench, 
  Truck, 
  ClipboardList, 
  LogOut, 
  Layout, 
  RefreshCw,
  Clock,
  Gauge,
  CheckCircle,
  Database,
  Layers,
  MoreHorizontal,
  X,
  ChevronDown,
  Warehouse,
  Smartphone,
  Monitor,
  Wifi,
  WifiOff,
  Share2,
  Copy,
  Check
} from "lucide-react";
import ParkingLotView from "./components/ParkingLotView";

export default function App() {
  const [activeTab, setActiveTab] = useState<"check_in" | "parking" | "maintenance" | "checkout" | "archive" | "parts" | "lists" | "designer">("check_in");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [cards, setCards] = useState<MaintenanceCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [targetCardId, setTargetCardId] = useState<string | null>(null);
  const [maintenanceInitialCardId, setMaintenanceInitialCardId] = useState<string | undefined>(undefined);
  const [showMobileMore, setShowMobileMore] = useState(false);

  // Real-time LAN synchronization states
  const [lanConnected, setLanConnected] = useState<boolean>(true);
  const [connectedClientsCount, setConnectedClientsCount] = useState<number>(1);
  const [networkInfo, setNetworkInfo] = useState<{ ip: string; port: number; localUrl: string; hostname?: string } | null>(null);
  const [showLanModal, setShowLanModal] = useState(false);
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);

  // Toggle phone mode state
  const [isPhoneMode, setIsPhoneMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("workshop_phone_mode") === "true";
    } catch {
      return false;
    }
  });

  const togglePhoneMode = () => {
    setIsPhoneMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem("workshop_phone_mode", next ? "true" : "false");
      } catch {}
      return next;
    });
  };

  // Cache snapshots to prevent unnecessary React re-renders when backend data has not changed
  const cardsSnapshotRef = useRef<string>("");
  const configSnapshotRef = useRef<string>("");

  // Fetch initial configuration and cards databases
  const fetchData = async (isBackground = false) => {
    if (!isBackground) setIsRefreshing(true);
    try {
      const [configRes, cardsRes] = await Promise.all([
        fetch("/api/config"),
        fetch("/api/cards")
      ]);

      if (configRes.ok && cardsRes.ok) {
        const configData = await configRes.json();
        const cardsData = await cardsRes.json();

        const newCardsSnapshot = JSON.stringify(cardsData);
        const newConfigSnapshot = JSON.stringify(configData);

        // ONLY update state if the data content has actually changed!
        if (newCardsSnapshot !== cardsSnapshotRef.current) {
          cardsSnapshotRef.current = newCardsSnapshot;
          setCards(cardsData);
        }

        if (newConfigSnapshot !== configSnapshotRef.current) {
          configSnapshotRef.current = newConfigSnapshot;
          setConfig(configData);
        }

        setLanConnected(true);
      }
    } catch (error) {
      console.error("Error synchronizing backend databases:", error);
      if (!isBackground) setLanConnected(false);
    } finally {
      setIsLoading(false);
      if (!isBackground) setIsRefreshing(false);
    }
  };

  // Fetch LAN IP and network parameters for easy sharing across computers
  const fetchNetworkInfo = async () => {
    try {
      const res = await fetch("/api/network-info");
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo(data);
        if (typeof data.connectedClients === "number") {
          setConnectedClientsCount(prev => prev === data.connectedClients ? prev : data.connectedClients);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchData();
    fetchNetworkInfo();
  }, []);

  // Real-Time SSE Listener with graceful reconnection and no UI thrashing
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;
    let sseActive = true;

    const connectSSE = () => {
      if (!sseActive) return;

      try {
        if (eventSource) {
          eventSource.close();
        }

        eventSource = new EventSource("/api/events");

        eventSource.onopen = () => {
          setLanConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "presence") {
              if (typeof data.connectedClients === "number") {
                setConnectedClientsCount(prev => prev === data.connectedClients ? prev : data.connectedClients);
              }
            } else if (data.type === "cards_updated") {
              // Seamless silent background fetch
              fetchData(true);
              if (data.summary) {
                setLastSyncNotice(data.summary);
                setTimeout(() => setLastSyncNotice(null), 3500);
              }
            } else if (data.type === "config_updated") {
              fetchData(true);
            }
          } catch (e) {
            // ignore parse error
          }
        };

        eventSource.onerror = () => {
          // Do not instantly toggle connection status or recreate SSE every second.
          // EventSource will automatically retry per SSE spec.
          // Only if explicitly CLOSED do we schedule a gentle reconnect after 6 seconds.
          if (eventSource?.readyState === EventSource.CLOSED && sseActive) {
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connectSSE, 6000);
          }
        };
      } catch (err) {
        if (sseActive) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectSSE, 8000);
        }
      }
    };

    connectSSE();

    // Fallback light heartbeat polling every 45 seconds (gentle background safety net, no rapid polling)
    const fallbackInterval = setInterval(() => {
      fetchData(true);
      fetchNetworkInfo();
    }, 45000);

    return () => {
      sseActive = false;
      if (eventSource) eventSource.close();
      clearTimeout(reconnectTimer);
      clearInterval(fallbackInterval);
    };
  }, []);

  const handleSaveTemplate = async (key: string, newTemplate: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newTemplate }),
      });
      if (response.ok) {
        // Refresh local data
        await fetchData();
        return true;
      }
    } catch (error) {
      console.error("Error saving customized report template:", error);
    }
    return false;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 space-y-4 text-slate-800" dir="rtl">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
        <h2 className="text-xl font-bold">جاري تحميل نظام الصيانة الفنية...</h2>
        <p className="text-xs text-slate-400">تحضير جداول البيانات وقوالب التقارير الذكية للورشة</p>
      </div>
    );
  }

  // Count active stats for dashboard
  const stats = {
    total: cards.length,
    parking: cards.filter(c => c.status !== "completed" && c.destination === "parking").length,
    checkIn: cards.filter(c => c.status === "check_in" && c.destination !== "parking").length,
    underMaintenance: cards.filter(c => c.status === "maintenance" && c.destination !== "parking").length,
    completed: cards.filter(c => c.status === "completed").length
  };

  // Define tabs with metadata
  const tabs = [
    { id: "check_in" as const, label: "تسجيل الدخول", shortLabel: "الدخول", icon: Truck, dotColor: "bg-blue-600" },
    { id: "parking" as const, label: "موقف المركبات", shortLabel: "الموقف", icon: Warehouse, dotColor: "bg-amber-500", badge: stats.parking > 0 ? stats.parking : undefined },
    { id: "maintenance" as const, label: "الصيانة والتشخيص", shortLabel: "الصيانة", icon: Wrench, dotColor: "bg-yellow-500", badge: stats.underMaintenance > 0 ? stats.underMaintenance : undefined },
    { id: "checkout" as const, label: "الخروج الفني", shortLabel: "الخروج", icon: LogOut, dotColor: "bg-emerald-600" },
    { id: "archive" as const, label: "السجل والأرشيف", shortLabel: "الأرشيف", icon: ClipboardList, dotColor: "bg-slate-700" },
    { id: "parts" as const, label: "قطع الغيار المستبدلة", shortLabel: "القطع", icon: Layers, dotColor: "bg-indigo-500" },
    { id: "lists" as const, label: "إدارة القوائم والأسطول", shortLabel: "القوائم", icon: Database, dotColor: "bg-indigo-600" },
    { id: "designer" as const, label: "تصميم قوالب التقارير", shortLabel: "القوالب", icon: Layout, dotColor: "bg-purple-600" },
  ];

  // Primary bottom tabs for mobile thumb zone
  const mobilePrimaryTabs = [
    { id: "check_in" as const, label: "الدخول", icon: Truck },
    { id: "parking" as const, label: "الموقف", icon: Warehouse, badge: stats.parking > 0 ? stats.parking : undefined },
    { id: "maintenance" as const, label: "الصيانة", icon: Wrench, badge: stats.underMaintenance > 0 ? stats.underMaintenance : undefined },
    { id: "checkout" as const, label: "الخروج", icon: LogOut },
  ];

  const isSecondaryTabActive = activeTab === "archive" || activeTab === "parts" || activeTab === "lists" || activeTab === "designer";

  return (
    <div className={`min-h-screen font-sans ${isPhoneMode ? 'bg-slate-900/95 py-0 lg:py-5 flex flex-col items-center justify-start text-slate-800' : 'bg-slate-100/50 text-slate-800 flex flex-col lg:flex-row'}`} dir="rtl">
      {/* Simulation Info Bar on Desktop when Phone Mode is active */}
      {isPhoneMode && (
        <div className="hidden lg:flex items-center justify-between w-full max-w-[430px] mb-2 px-3.5 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs border border-slate-700/80 shadow-md">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span className="font-extrabold text-white">وضع الهاتف المحمول (مفعل)</span>
          </div>
          <button
            onClick={togglePhoneMode}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-bold transition cursor-pointer border border-white/20"
            title="الرجوع إلى وضع سطح المكتب"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>وضع الحاسوب</span>
          </button>
        </div>
      )}

      {/* Main Container / Mobile Device Frame */}
      <div className={isPhoneMode ? "w-full max-w-[430px] bg-slate-50 min-h-screen lg:min-h-[860px] lg:max-h-[94vh] shadow-2xl lg:rounded-3xl border border-slate-300 relative flex flex-col flex-1 overflow-x-hidden overflow-y-auto" : "flex-1 flex flex-col lg:flex-row min-w-0"}>
        {/* Sidebar - Visible on Desktop */}
        <aside className={`w-72 bg-white border-l border-slate-200 flex flex-col shrink-0 ${isPhoneMode ? 'hidden' : 'hidden lg:flex'}`}>
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-2.5 text-blue-600 mb-1">
              <Wrench className="w-6 h-6" />
              <span className="font-extrabold text-lg tracking-tight text-slate-900">نظام الورشة فني</span>
            </div>
            <p className="text-[10px] text-slate-400">لإدارة صيانة الأسطول v2.0</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-1.5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab_${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-right px-4 py-3 rounded-lg flex items-center justify-between font-bold text-xs sm:text-sm cursor-pointer transition-all ${
                    isActive
                      ? "bg-blue-50/75 text-blue-600 font-bold shadow-2xs"
                      : "hover:bg-slate-50 text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <tab.icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? tab.dotColor : "bg-transparent border border-slate-300"}`}></span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">أ.م</div>
              <div className="text-xs">
                <p className="font-bold text-slate-800">أحمد محمود</p>
                <p className="text-[10px] text-slate-400">مسؤول الورشة الفني</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Top Header for Mobile & Phone Mode */}
        <header className={`bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-2xs ${isPhoneMode ? 'block' : 'lg:hidden'}`}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="bg-blue-600 p-2 rounded-xl text-white shrink-0 shadow-2xs">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black text-slate-900 truncate">نظام الورشة</h1>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 truncate">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">إدارة ومتابعة بطاقات الورشة الفنية</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Button at top to toggle phone mode */}
              <button
                id="btn_toggle_phone_mode_mobile"
                type="button"
                onClick={togglePhoneMode}
                className={`min-h-[36px] px-2.5 flex items-center gap-1.5 justify-center rounded-xl transition text-xs font-bold cursor-pointer border ${
                  isPhoneMode
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                    : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                }`}
                title={isPhoneMode ? "الرجوع لوضع سطح المكتب" : "تغيير إلى وضع الهاتف"}
              >
                {isPhoneMode ? (
                  <>
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">وضع الحاسوب</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">وضع الهاتف</span>
                  </>
                )}
              </button>

              <button
                id="btn_sync_db_mobile"
                onClick={() => fetchData(false)}
                disabled={isRefreshing}
                className="min-h-[36px] min-w-[36px] px-2 flex items-center gap-1 justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition disabled:opacity-50 cursor-pointer"
                title="تحديث البيانات فوراً"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile / Phone Mode Horizontal Pages Tab Strip */}
        <div className={`bg-white border-b border-slate-200 px-2.5 py-2 overflow-x-auto scrollbar-none shrink-0 shadow-3xs ${isPhoneMode ? 'flex' : 'flex lg:hidden'}`}>
          <div className="flex items-center gap-1.5 min-w-max">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`mobile_top_tab_${tab.id}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowMobileMore(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-2xs font-extrabold"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                      isActive ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col min-w-0 bg-slate-50 ${isPhoneMode ? 'pb-24 lg:pb-0' : 'pb-20 lg:pb-0'}`}>
          {/* Desktop Header */}
          <header className={`h-16 bg-white border-b border-slate-200 px-8 items-center justify-between shadow-2xs shrink-0 ${isPhoneMode ? 'hidden' : 'hidden lg:flex'}`}>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-extrabold text-slate-900">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-sm tracking-wide uppercase">
                قيد التشغيل
              </span>
            </div>
            
            <div className="flex items-center gap-2.5">
              {/* Button at top on desktop to switch to Phone mode */}
              <button
                id="btn_toggle_phone_mode_desktop"
                type="button"
                onClick={togglePhoneMode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                title="تغيير العرض إلى وضع الهاتف"
              >
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>وضع الهاتف</span>
              </button>

              <button
                id="btn_sync_db"
                onClick={() => fetchData(false)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                title="تحديث البيانات ومزامنة التغييرات"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                <span>تحديث البيانات</span>
              </button>
            </div>
          </header>

        {/* Dynamic Inner Panel containing active view */}
        <div className="flex-1 p-3 sm:p-5 md:p-8 overflow-y-auto">
          {/* Bento Stats Grid inside Main */}
          {(!isPhoneMode || (activeTab !== "lists" && activeTab !== "designer" && activeTab !== "parts")) && (
            <div className={`${isPhoneMode ? 'flex overflow-x-auto pb-2 gap-2.5 scrollbar-none' : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4'} mb-4 sm:mb-6`}>
              <div className={`bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between ${isPhoneMode ? 'min-w-[120px] shrink-0' : ''}`}>
                <div>
                  <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wide">إجمالي البطاقات</span>
                  <p className="text-base sm:text-xl font-extrabold text-slate-800 font-mono mt-0.5">{stats.total}</p>
                </div>
                <div className="bg-slate-50 p-1.5 sm:p-2 rounded-lg text-slate-400">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("parking")}
                className={`p-3 rounded-xl border transition text-right shadow-2xs flex items-center justify-between cursor-pointer ${isPhoneMode ? 'min-w-[120px] shrink-0' : ''} ${
                  activeTab === "parking"
                    ? "bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/30"
                    : "bg-white border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/30"
                }`}
              >
                <div>
                  <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wide">موقف المركبات</span>
                  <p className="text-base sm:text-xl font-extrabold text-amber-700 font-mono mt-0.5">{stats.parking}</p>
                </div>
                <div className="bg-amber-50 p-1.5 sm:p-2 rounded-lg text-amber-500">
                  <Warehouse className="w-4 h-4" />
                </div>
              </button>
              
              <div className={`bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between ${isPhoneMode ? 'min-w-[120px] shrink-0' : ''}`}>
                <div>
                  <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wide">بانتظار الفحص</span>
                  <p className="text-base sm:text-xl font-extrabold text-blue-600 font-mono mt-0.5">{stats.checkIn}</p>
                </div>
                <div className="bg-blue-50 p-1.5 sm:p-2 rounded-lg text-blue-500">
                  <Truck className="w-4 h-4" />
                </div>
              </div>

              <div className={`bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between ${isPhoneMode ? 'min-w-[120px] shrink-0' : ''}`}>
                <div>
                  <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wide">قيد الصيانة</span>
                  <p className="text-base sm:text-xl font-extrabold text-yellow-600 font-mono mt-0.5">{stats.underMaintenance}</p>
                </div>
                <div className="bg-yellow-50 p-1.5 sm:p-2 rounded-lg text-yellow-500">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>

              <div className={`bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between ${isPhoneMode ? 'min-w-[120px] shrink-0' : 'col-span-2 sm:col-span-1'}`}>
                <div>
                  <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wide">جاهزة ومسلمة</span>
                  <p className="text-base sm:text-xl font-extrabold text-emerald-600 font-mono mt-0.5">{stats.completed}</p>
                </div>
                <div className="bg-emerald-50 p-1.5 sm:p-2 rounded-lg text-emerald-500">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xs border border-slate-200 p-3 sm:p-5 md:p-6" id="view_layer_card">
            {activeTab === "check_in" && config && (
              <CheckInForm
                defaultVehicles={config.default_vehicles}
                defaultDrivers={config.default_drivers}
                cards={cards}
                driverPhones={config.driver_phones}
                onSuccess={fetchData}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === "parking" && (
              <ParkingLotView
                cards={cards}
                onRefresh={fetchData}
                driverPhones={config?.driver_phones}
                onNavigateToMaintenance={(cardId) => {
                  setMaintenanceInitialCardId(cardId);
                  setActiveTab("maintenance");
                }}
                onNavigateToCheckIn={() => {
                  setActiveTab("check_in");
                }}
              />
            )}

            {activeTab === "maintenance" && config && (
              <MaintenanceForm
                defaultWorkTeams={config.default_work_teams}
                defaultWorkers={config.default_workers || []}
                cards={cards}
                workerPhones={config.worker_phones}
                initialCardId={maintenanceInitialCardId}
                onNavigateToParking={() => setActiveTab("parking")}
                onSuccess={() => {
                  setMaintenanceInitialCardId(undefined);
                  fetchData();
                }}
              />
            )}

            {activeTab === "checkout" && (
              <CheckOutForm
                cards={cards}
                onSuccess={fetchData}
              />
            )}

            {activeTab === "archive" && (
              <ReportArchive
                cards={cards}
                onRefresh={fetchData}
                defaultWorkTeams={config?.default_work_teams || []}
                defaultWorkers={config?.default_workers || []}
                defaultVehicles={config?.default_vehicles || []}
                defaultDrivers={config?.default_drivers || []}
                driverPhones={config?.driver_phones}
                workerPhones={config?.worker_phones}
                targetCardId={targetCardId}
                onClearTargetCardId={() => setTargetCardId(null)}
                isPhoneMode={isPhoneMode}
              />
            )}

            {activeTab === "parts" && (
              <ReplacedPartsList
                cards={cards}
                driverPhones={config?.driver_phones}
                workerPhones={config?.worker_phones}
                onNavigateToCard={(cardId) => {
                  setTargetCardId(cardId);
                  setActiveTab("archive");
                }}
                isPhoneMode={isPhoneMode}
              />
            )}

            {activeTab === "lists" && config && (
              <ListsManager
                config={config}
                cards={cards}
                onNavigateToCard={(cardId) => {
                  setTargetCardId(cardId);
                  setActiveTab("archive");
                }}
                onSuccess={fetchData}
                onOpenLanSettings={() => setShowLanModal(true)}
                lanConnected={lanConnected}
                connectedClientsCount={connectedClientsCount}
                networkInfo={networkInfo}
                isPhoneMode={isPhoneMode}
              />
            )}

            {activeTab === "designer" && config && (
              <TemplateDesigner
                initialTemplate={config.html_template}
                initialDailyTemplate={config.daily_report_template || ""}
                initialMonthlyTemplate={config.monthly_report_template || ""}
                onSave={handleSaveTemplate}
                cards={cards}
                onFormatDatabase={fetchData}
                isPhoneMode={isPhoneMode}
              />
            )}
          </div>
        </div>

        {/* Simple Minimalist Footer */}
        <footer className="bg-white border-t border-slate-200/85 py-3 sm:py-4 px-4 sm:px-8 text-xs text-slate-400 font-semibold shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2.5 text-center sm:text-right">
            <span>جميع الحقوق محفوظة ل IMAD STORE LTD © {new Date().getFullYear()}</span>
            <span className="text-[10px] text-slate-300">أمن قاعدة البيانات النشط • {config?.db_path || "maintenance.db"}</span>
          </div>
        </footer>
      </main>

      {/* Mobile Ergonomic Bottom Tab Navigation Dock (Thumb Zone) */}
      <nav 
        aria-label="التنقل السريع للهاتف"
        className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] pb-safe ${isPhoneMode ? 'block max-w-[430px] mx-auto lg:sticky lg:bottom-0' : 'lg:hidden'}`}
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {mobilePrimaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowMobileMore(false);
                }}
                className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition cursor-pointer relative ${
                  isActive ? "text-blue-600 font-black" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <div className="relative">
                  <tab.icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 bg-yellow-500 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold mt-1 tracking-tight truncate max-w-[60px] text-center">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5"></span>
                )}
              </button>
            );
          })}

          {/* "المزيد" Tab Button for mobile */}
          <button
            type="button"
            onClick={() => setShowMobileMore(prev => !prev)}
            className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition cursor-pointer relative ${
              isSecondaryTabActive || showMobileMore
                ? "text-indigo-600 font-black" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MoreHorizontal className={`w-5 h-5 transition-transform ${showMobileMore ? "rotate-90 text-indigo-600" : ""}`} />
            <span className="text-[10px] font-bold mt-1 tracking-tight truncate max-w-[60px] text-center">
              المزيد
            </span>
            {isSecondaryTabActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-0.5"></span>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile "More" Sheet / Drawer */}
      {showMobileMore && (
        <div 
          className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end animate-fadeIn ${isPhoneMode ? 'block max-w-[430px] mx-auto' : 'lg:hidden'}`}
          onClick={() => setShowMobileMore(false)}
        >
          <div 
            className="bg-white rounded-t-3xl border-t border-slate-200 p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto animate-slideUp text-right max-w-[430px] mx-auto w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-2"></div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">أقسام وإعدادات الورشة</h3>
                <p className="text-[11px] text-slate-400">انتقال سريع للأدوات والقوائم الفنية</p>
              </div>
              <button 
                onClick={() => setShowMobileMore(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("archive");
                  setShowMobileMore(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-right transition cursor-pointer min-h-[52px] ${
                  activeTab === "archive"
                    ? "bg-slate-100 border-slate-300 text-slate-900 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-200 text-slate-700">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-xs sm:text-sm text-slate-900">السجل والأرشيف الفني</span>
                    <span className="block text-[10px] text-slate-400">سجل كافة البطاقات المنتهية وتصدير التقارير</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-slate-700"></span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("parts");
                  setShowMobileMore(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-right transition cursor-pointer min-h-[52px] ${
                  activeTab === "parts"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-xs sm:text-sm text-slate-900">سجل قطع الغيار المستبدلة</span>
                    <span className="block text-[10px] text-slate-400">تتبع استهلاك المواد وقطع الشاحنات</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("lists");
                  setShowMobileMore(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-right transition cursor-pointer min-h-[52px] ${
                  activeTab === "lists"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-xs sm:text-sm text-slate-900">إدارة القوائم والأسطول</span>
                    <span className="block text-[10px] text-slate-400">تعديل الفنيين والسائقين والشاحنات وهواتفهم</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("designer");
                  setShowMobileMore(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-right transition cursor-pointer min-h-[52px] ${
                  activeTab === "designer"
                    ? "bg-purple-50 border-purple-200 text-purple-900 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                    <Layout className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-xs sm:text-sm text-slate-900">تصميم قوالب التقارير</span>
                    <span className="block text-[10px] text-slate-400">تخصيص هيكل البطاقات والتقرير اليومي والشهري</span>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  fetchData();
                  setShowMobileMore(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                <span>مزامنة وتحديث كافة قواعد البيانات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LAN Multi-Device Network Connection Modal */}
      {showLanModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          dir="rtl"
          onClick={() => setShowLanModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-scaleUp text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    استخدام النظام عبر أجهزة متعددة في الشبكة المحلية (LAN)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    الربط المباشر والمزامنة الفورية بين حواسيب الورشة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLanModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Connection Status Box */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                lanConnected ? "bg-emerald-50 border-emerald-200 text-emerald-950" : "bg-rose-50 border-rose-200 text-rose-950"
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${lanConnected ? "bg-emerald-500 animate-ping" : "bg-rose-500"}`}></span>
                  <div>
                    <strong className="block font-black text-sm">
                      {lanConnected ? "قناة المزامنة الحية متصلة ونشطة" : "انقطاع في قناة البث المباشر"}
                    </strong>
                    <span className="text-[11px] text-slate-600">
                      عدد الأجهزة المتصلة والمتزامنة حالياً: <strong className="font-mono text-slate-900">{connectedClientsCount}</strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchData(false)}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>تحديث</span>
                </button>
              </div>

              {/* Local Network URL for other PCs */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  رابط الدخول المباشر من أي جهاز أو كمبيوتر آخر بنفس شبكة الورشة:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    dir="ltr"
                    value={networkInfo ? networkInfo.localUrl : window.location.origin}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm font-bold text-blue-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = networkInfo ? networkInfo.localUrl : window.location.origin;
                      navigator.clipboard?.writeText(url);
                      setLastSyncNotice("تم نسخ رابط الشبكة المحلية إلى الحافظة!");
                      setTimeout(() => setLastSyncNotice(null), 3000);
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    title="نسخ الرابط"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  انسخ هذا الرابط وافتحه في متصفح أي كمبيوتر (كروم، إيدج) متصل بنفس شبكة الواي فاي أو كابل الشبكة.
                </p>
              </div>

              {/* Smooth LAN features benefits list */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h4 className="font-extrabold text-slate-800 text-xs">مميزات العمل المتعدد بسلاسة:</h4>
                <ul className="space-y-1.5 text-[11px] text-slate-600 list-disc list-inside">
                  <li><strong>مزامنة لحظية فورية (Real-time SSE):</strong> أي إضافة أو تعديل لبطاقة صيانة يظهر تلقائياً لجميع الحواسيب الأخرى بدون الحاجة لإعادة تحميل الصفحة يدوياً.</li>
                  <li><strong>حماية متقدمة من التكرار:</strong> فحص تلقائي وفوري يمنع إدخال نفس المركبة من أكثر من موظف في نفس الوقت.</li>
                  <li><strong>أمان قاعدة البيانات المتزامن:</strong> حفظ آمن من خلال كتابة ذرية (Atomic Writes) يضمن سلامة البيانات من أي تضارب بين الأجهزة المتزامنة.</li>
                  <li><strong>العمل السلس دون بطء:</strong> تحديث خلفي صامت وسريع يضمن استجابة فورية للأزرار والنماذج.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLanModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition cursor-pointer text-xs"
              >
                فهمت، إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-intrusive Floating Live Sync Toast (never causes layout shift or typing loss) */}
      {lastSyncNotice && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-50 p-3 bg-slate-900/90 text-white backdrop-blur-md border border-slate-700/80 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-2xl transition-all duration-300 animate-fadeIn pointer-events-none max-w-sm"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
          <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 truncate">
            <span className="text-slate-300">مزامنة الشبكة: </span>
            <span className="font-extrabold text-white">{lastSyncNotice}</span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
