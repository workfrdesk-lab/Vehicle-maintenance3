/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { MaintenanceCard } from "../types";
import { 
  Truck, 
  User, 
  Calendar, 
  FileText, 
  PlusCircle, 
  CheckCircle, 
  Sparkles, 
  ChevronDown, 
  X,
  Clock,
  Phone,
  Warehouse,
  Wrench,
  Compass,
  AlertTriangle,
  ShieldAlert
} from "lucide-react";

interface CheckInFormProps {
  defaultVehicles: string[];
  defaultDrivers: string[];
  cards?: MaintenanceCard[];
  driverPhones?: Record<string, string>;
  onSuccess: () => void;
  onNavigateTab?: (tab: "check_in" | "parking" | "maintenance" | "checkout" | "archive" | "parts" | "lists" | "designer") => void;
}

interface AutoFillNotice {
  type: "vehicle" | "driver";
  title: string;
  vehicle?: string;
  driver?: string;
  trailer?: string;
  date?: string;
}

export default function CheckInForm({ 
  defaultVehicles = [], 
  defaultDrivers = [], 
  cards = [], 
  driverPhones = {},
  onSuccess,
  onNavigateTab
}: CheckInFormProps) {
  const [vehicleId, setVehicleId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [trailerId, setTrailerId] = useState("");
  const [damageType, setDamageType] = useState("");
  const [dateIn, setDateIn] = useState("");
  const [destination, setDestination] = useState<"workshop" | "parking">("workshop");
  const [errorWord, setErrorWord] = useState("");
  const [successWord, setSuccessWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Duplicate vehicle alert modal state
  const [duplicateModalCard, setDuplicateModalCard] = useState<MaintenanceCard | null>(null);

  // Autocomplete dropdown visibility states
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [autoFillNotice, setAutoFillNotice] = useState<AutoFillNotice | null>(null);

  const vehicleWrapperRef = useRef<HTMLDivElement>(null);
  const driverWrapperRef = useRef<HTMLDivElement>(null);
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);

  // Parse card date timestamp accurately supporting DD/MM/YYYY and ISO formats
  const parseCardTime = (dateStr?: string) => {
    if (!dateStr) return 0;
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, d, m, y] = match;
      return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
    }
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? 0 : t;
  };

  const formatDateDisplay = (d?: string) => {
    if (!d) return "";
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return d.split("T")[0];
  };

  // Set today's date in DD/MM/YYYY format as default
  useEffect(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    setDateIn(`${day}/${month}/${year}`);
  }, []);

  const handleCalendarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // "YYYY-MM-DD"
    if (val) {
      const [y, m, d] = val.split("-");
      if (y && m && d) {
        setDateIn(`${d}/${m}/${y}`);
      }
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (vehicleWrapperRef.current && !vehicleWrapperRef.current.contains(event.target as Node)) {
        setShowVehicleDropdown(false);
      }
      if (driverWrapperRef.current && !driverWrapperRef.current.contains(event.target as Node)) {
        setShowDriverDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Helper: find the latest card for a specific vehicle plate
  const getLatestCardForVehicle = (vNum: string): MaintenanceCard | undefined => {
    if (!vNum || !cards || cards.length === 0) return undefined;
    const cleanV = vNum.trim().toLowerCase();
    const matching = cards.filter(c => c.vehicle_id && c.vehicle_id.trim().toLowerCase() === cleanV);
    if (matching.length === 0) return undefined;

    return [...matching].sort((a, b) => {
      const timeA = parseCardTime(a.date_in);
      const timeB = parseCardTime(b.date_in);
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    })[0];
  };

  // Helper: find the latest card for a specific driver name
  const getLatestCardForDriver = (dName: string): MaintenanceCard | undefined => {
    if (!dName || !cards || cards.length === 0) return undefined;
    const cleanD = dName.trim().toLowerCase();
    const matching = cards.filter(c => c.driver_name && c.driver_name.trim().toLowerCase() === cleanD);
    if (matching.length === 0) return undefined;

    return [...matching].sort((a, b) => {
      const timeA = parseCardTime(a.date_in);
      const timeB = parseCardTime(b.date_in);
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    })[0];
  };

  // Select vehicle and auto-fill driver + trailer according to latest check-in
  const selectVehicle = (vNum: string) => {
    const trimmed = vNum.trim();
    setVehicleId(trimmed);
    setShowVehicleDropdown(false);

    const latest = getLatestCardForVehicle(trimmed);
    if (latest) {
      if (latest.driver_name) {
        setDriverName(latest.driver_name);
      }
      setTrailerId(latest.trailer_id || "");
      setAutoFillNotice({
        type: "vehicle",
        title: `تم جلب بيانات آخر تسجيل دخول للمركبة (${trimmed})`,
        vehicle: trimmed,
        driver: latest.driver_name,
        trailer: latest.trailer_id || "بدون مقطورة",
        date: latest.date_in,
      });
    } else {
      setAutoFillNotice(null);
    }
  };

  // Select driver and auto-fill vehicle + trailer according to latest check-in
  const selectDriver = (dName: string) => {
    const trimmed = dName.trim();
    setDriverName(trimmed);
    setShowDriverDropdown(false);

    const latest = getLatestCardForDriver(trimmed);
    if (latest) {
      if (latest.vehicle_id) {
        setVehicleId(latest.vehicle_id);
      }
      setTrailerId(latest.trailer_id || "");
      setAutoFillNotice({
        type: "driver",
        title: `تم جلب بيانات آخر تسجيل دخول للسائق (${trimmed})`,
        driver: trimmed,
        vehicle: latest.vehicle_id,
        trailer: latest.trailer_id || "بدون مقطورة",
        date: latest.date_in,
      });
    } else {
      setAutoFillNotice(null);
    }
  };

  // Handle typing in vehicle input
  const handleVehicleChange = (val: string) => {
    setVehicleId(val);
    setShowVehicleDropdown(true);

    // If typed value is an exact match with an existing vehicle, suggest or fill if fields are empty
    const exact = allVehicles.find(v => v.toLowerCase() === val.trim().toLowerCase());
    if (exact) {
      const latest = getLatestCardForVehicle(exact);
      if (latest) {
        // NEVER overwrite driver or trailer if user already typed one
        if (latest.driver_name && !driverName.trim()) setDriverName(latest.driver_name);
        if (latest.trailer_id && !trailerId.trim()) setTrailerId(latest.trailer_id);
        setAutoFillNotice({
          type: "vehicle",
          title: `تم العثور على آخر تسجيل للمركبة (${exact})`,
          vehicle: exact,
          driver: latest.driver_name,
          trailer: latest.trailer_id || "بدون مقطورة",
          date: latest.date_in,
        });
      }
    }
  };

  // Handle typing in driver input
  const handleDriverChange = (val: string) => {
    setDriverName(val);
    setShowDriverDropdown(true);

    const exact = allDrivers.find(d => d.toLowerCase() === val.trim().toLowerCase());
    if (exact) {
      const latest = getLatestCardForDriver(exact);
      if (latest) {
        // NEVER overwrite vehicle or trailer if user already typed one
        if (latest.vehicle_id && !vehicleId.trim()) setVehicleId(latest.vehicle_id);
        if (latest.trailer_id && !trailerId.trim()) setTrailerId(latest.trailer_id);
        setAutoFillNotice({
          type: "driver",
          title: `تم العثور على آخر تسجيل للسائق (${exact})`,
          driver: exact,
          vehicle: latest.vehicle_id,
          trailer: latest.trailer_id || "بدون مقطورة",
          date: latest.date_in,
        });
      }
    }
  };

  // Deduplicated list of all vehicles (recent cards first, then defaultVehicles)
  const allVehicles = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // From cards (most recent first)
    const sortedCards = [...cards].sort((a, b) => {
      const timeA = parseCardTime(a.date_in);
      const timeB = parseCardTime(b.date_in);
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    });

    sortedCards.forEach(c => {
      const v = c.vehicle_id?.trim();
      if (v && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        list.push(v);
      }
    });

    defaultVehicles.forEach(v => {
      const trimmed = v?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    return list;
  }, [cards, defaultVehicles]);

  // Deduplicated list of all drivers (recent cards first, then defaultDrivers)
  const allDrivers = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    const sortedCards = [...cards].sort((a, b) => {
      const timeA = parseCardTime(a.date_in);
      const timeB = parseCardTime(b.date_in);
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    });

    sortedCards.forEach(c => {
      const d = c.driver_name?.trim();
      if (d && !seen.has(d.toLowerCase())) {
        seen.add(d.toLowerCase());
        list.push(d);
      }
    });

    defaultDrivers.forEach(d => {
      const trimmed = d?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    });

    return list;
  }, [cards, defaultDrivers]);

  // Filtered lists for dropdown display
  const filteredVehicles = useMemo(() => {
    const q = vehicleId.trim().toLowerCase();
    if (!q) return allVehicles.slice(0, 15);
    return allVehicles.filter(v => v.toLowerCase().includes(q)).slice(0, 20);
  }, [allVehicles, vehicleId]);

  const filteredDrivers = useMemo(() => {
    const q = driverName.trim().toLowerCase();
    if (!q) return allDrivers.slice(0, 15);
    return allDrivers.filter(d => d.toLowerCase().includes(q)).slice(0, 20);
  }, [allDrivers, driverName]);

  // Check for active duplicate vehicle or trailer (in workshop or parking lot)
  const activeDuplicateCard = useMemo(() => {
    if (!cards || cards.length === 0) return null;
    const cleanV = vehicleId.trim().toLowerCase();
    const cleanT = trailerId.trim().toLowerCase();
    if (!cleanV && !cleanT) return null;

    return cards.find(c => {
      if (c.status === "completed") return false;
      const matchVehicle = !!cleanV && !!c.vehicle_id && c.vehicle_id.trim().toLowerCase() === cleanV;
      const matchTrailer = !!cleanT && !!c.trailer_id && c.trailer_id.trim().toLowerCase() === cleanT;
      return matchVehicle || matchTrailer;
    }) || null;
  }, [cards, vehicleId, trailerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorWord("");
    setSuccessWord("");

    const hasVehicle = !!vehicleId.trim();
    const hasTrailer = !!trailerId.trim();

    if (!hasVehicle && !hasTrailer) {
      setErrorWord("الرجاء إدخال رقم المركبة أو رقم المقطورة (أحدهما على الأقل مطلوب)");
      return;
    }
    if (!driverName.trim()) {
      setErrorWord("اسم السائق حقل إجباري");
      return;
    }

    // Verify not entering vehicle twice: show warning modal if already in workshop or parking
    if (activeDuplicateCard) {
      setDuplicateModalCard(activeDuplicateCard);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          driver_name: driverName,
          trailer_id: trailerId,
          damage_type: damageType,
          date_in: dateIn,
          destination: destination
        }),
      });

      const res = await response.json();
      if (response.ok) {
        const destLabel = destination === "parking" ? "موقف المركبات والحظيرة" : "الورشة الفنية";
        setSuccessWord(`تم تسجيل دخول المركبة وتوجيهها إلى ${destLabel} بنجاح! الرقم التسلسلي: ${res.card.id}`);
        setVehicleId("");
        setDriverName("");
        setTrailerId("");
        setDamageType("");
        setDestination("workshop");
        setAutoFillNotice(null);
        onSuccess();
      } else {
        if (response.status === 409 && res.duplicateCard) {
          setDuplicateModalCard(res.duplicateCard);
        } else {
          setErrorWord(res.error || "فشل تسجيل الدخول");
        }
      }
    } catch (err) {
      setErrorWord("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200" id="check-in-section">
      <div className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 sm:p-2.5 rounded-xl text-blue-600 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2
              className="font-extrabold text-slate-900"
              style={{
                fontSize: "20px",
                height: "30px",
                paddingLeft: "0px",
                paddingTop: "0px",
                marginRight: "10px",
                marginLeft: "10px",
                marginBottom: "0px",
                marginTop: "0px",
              }}
            >
              تسجيل دخول مركبة جديدة
            </h2>
            <p className="text-[10px] text-slate-400">تحضير وإصدار بطاقة صيانة فنية جديدة للمركبة المستلمة</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
        {errorWord && (
          <div className="bg-rose-50 border-r-4 border-rose-500 text-rose-800 p-3 sm:p-4 rounded-xl text-xs font-bold" role="alert">
            {errorWord}
          </div>
        )}

        {successWord && (
          <div className="bg-emerald-50 border-r-4 border-emerald-500 text-emerald-800 p-3 sm:p-4 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successWord}</span>
          </div>
        )}



        {/* Auto-fill notification alert */}
        {autoFillNotice && (
          <div className="bg-blue-50 border border-blue-200 text-blue-950 p-3 rounded-xl text-xs flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-blue-900">{autoFillNotice.title}</p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  {autoFillNotice.type === "vehicle" ? (
                    <>
                      السائق: <strong className="text-slate-900">{autoFillNotice.driver}</strong>
                      {" | "}
                      المقطورة: <strong className="text-slate-900">{autoFillNotice.trailer}</strong>
                    </>
                  ) : (
                    <>
                      المركبة: <strong className="text-slate-900">{autoFillNotice.vehicle || "بدون"}</strong>
                      {" | "}
                      المقطورة: <strong className="text-slate-900">{autoFillNotice.trailer}</strong>
                    </>
                  )}
                  {autoFillNotice.date && (
                    <span className="text-[10px] text-slate-500 mr-2">
                      (تاريخ آخر دخول: {autoFillNotice.date.replace("T", " ")})
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAutoFillNotice(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
              title="إغلاق التنبيه"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Vehicle ID with Interactive Auto-fill Dropdown */}
          <div className="space-y-1.5 relative" ref={vehicleWrapperRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
              <span className="flex items-center gap-1">
                <span className="text-black font-black" style={{ fontSize: "18px" }}>رقم المركبة</span>
                <span className="text-slate-500 text-[10px] font-normal">(مطلوب إن لم توجد مقطورة)</span>
              </span>
              <span className="text-[10px] text-blue-600 font-normal">اختيار المركبة يملأ السائق والمقطورة</span>
            </label>
            <div className="relative">
              <input
                id="vehicle_id_input"
                type="text"
                autoComplete="off"
                value={vehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
                onFocus={() => setShowVehicleDropdown(true)}
                onClick={() => setShowVehicleDropdown(true)}
                placeholder="أدخل رقم اللوحة أو اضغط للاختيار من القائمة..."
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-black rounded-lg focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none transition-all placeholder:text-slate-500 text-black font-black text-sm min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowVehicleDropdown(prev => !prev)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black hover:text-slate-700 p-2 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                tabIndex={-1}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showVehicleDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Custom Rich Dropdown */}
              {showVehicleDropdown && filteredVehicles.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-40 divide-y divide-slate-100">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 flex items-center justify-between">
                    <span>قائمة المركبات (اضغط للملء التلقائي)</span>
                    <span>{filteredVehicles.length} نتيجة</span>
                  </div>
                  {filteredVehicles.map((v) => {
                    const latest = getLatestCardForVehicle(v);
                    const isSelected = vehicleId.trim().toLowerCase() === v.toLowerCase();
                    return (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectVehicle(v);
                        }}
                        className={`w-full text-right px-3.5 py-2.5 text-xs hover:bg-blue-50/80 transition flex items-center justify-between group cursor-pointer ${
                          isSelected ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-black text-slate-900 group-hover:text-blue-700">{v}</span>
                          </div>
                          {latest ? (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 pr-5">
                              <span>السائق: <strong className="text-slate-700">{latest.driver_name}</strong></span>
                              <span>•</span>
                              <span>المقطورة: <strong className="text-slate-700">{latest.trailer_id || "بدون"}</strong></span>
                              {latest.date_in && (
                                <span className="text-slate-400">({formatDateDisplay(latest.date_in)})</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 pr-5">
                              مركبة مسجلة جديدة (لا يوجد سجل دخول سابق)
                            </div>
                          )}
                        </div>

                        {latest && (
                          <span className="text-[10px] text-blue-600 bg-blue-50 group-hover:bg-blue-100 px-2 py-0.5 rounded font-medium shrink-0">
                            تعبئة آلية
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Driver Name with Interactive Auto-fill Dropdown */}
          <div className="space-y-1.5 relative" ref={driverWrapperRef}>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
              <span className="flex items-center gap-1">
                <span className="text-black font-black" style={{ fontSize: "18px" }}>اسم السائق</span>
                <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-blue-600 font-normal">اختيار السائق يملأ المركبة والمقطورة</span>
            </label>
            <div className="relative">
              <input
                id="driver_name_input"
                type="text"
                autoComplete="off"
                value={driverName}
                onChange={(e) => handleDriverChange(e.target.value)}
                onFocus={() => setShowDriverDropdown(true)}
                onClick={() => setShowDriverDropdown(true)}
                placeholder="أدخل اسم السائق أو اضغط للاختيار من القائمة..."
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-black rounded-lg focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none transition-all placeholder:text-slate-500 text-black font-black text-sm min-h-[44px]"
                required
              />
              <button
                type="button"
                onClick={() => setShowDriverDropdown(prev => !prev)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black hover:text-slate-700 p-2 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                tabIndex={-1}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showDriverDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Custom Rich Dropdown */}
              {showDriverDropdown && filteredDrivers.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-40 divide-y divide-slate-100">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 flex items-center justify-between">
                    <span>قائمة السائقين (اضغط للملء التلقائي)</span>
                    <span>{filteredDrivers.length} نتيجة</span>
                  </div>
                  {filteredDrivers.map((d) => {
                    const latest = getLatestCardForDriver(d);
                    const isSelected = driverName.trim().toLowerCase() === d.toLowerCase();
                    return (
                      <button
                        key={d}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectDriver(d);
                        }}
                        className={`w-full text-right px-3.5 py-2.5 text-xs hover:bg-blue-50/80 transition flex items-center justify-between group cursor-pointer ${
                          isSelected ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-black text-slate-900 group-hover:text-blue-700">{d}</span>
                            {driverPhones[d] && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-1" dir="ltr">
                                <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                {driverPhones[d]}
                              </span>
                            )}
                          </div>
                          {latest ? (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 pr-5">
                              <span>المركبة: <strong className="text-slate-700">{latest.vehicle_id || "بدون"}</strong></span>
                              <span>•</span>
                              <span>المقطورة: <strong className="text-slate-700">{latest.trailer_id || "بدون"}</strong></span>
                              {latest.date_in && (
                                <span className="text-slate-400">({formatDateDisplay(latest.date_in)})</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 pr-5">
                              سائق مسجل جديد (لا يوجد سجل دخول سابق)
                            </div>
                          )}
                        </div>

                        {latest && (
                          <span className="text-[10px] text-blue-600 bg-blue-50 group-hover:bg-blue-100 px-2 py-0.5 rounded font-medium shrink-0">
                            تعبئة آلية
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Display driver phone if available */}
            {driverPhones[driverName.trim()] && (
              <div className="flex items-center gap-2 text-xs pt-1 px-1">
                <span className="text-slate-400 text-[11px] font-semibold">هاتف السائق:</span>
                <a
                  href={`tel:${driverPhones[driverName.trim()]}`}
                  className="text-emerald-700 hover:text-emerald-900 font-mono font-bold flex items-center gap-1.5 text-[11px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-md transition shadow-2xs"
                  dir="ltr"
                  title="انقر للاتصال المباشر بالسائق"
                >
                  <Phone className="w-3 h-3 text-emerald-600" />
                  <span>{driverPhones[driverName.trim()]}</span>
                </a>
              </div>
            )}
          </div>

          {/* Trailer ID (Optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
              <span className="text-black font-black" style={{ fontSize: "18px" }}>رقم المقطورة</span>
              <span className="text-slate-500 text-[10px] font-normal">(مطلوب إن لم يحدد رقم مركبة)</span>
            </label>
            <input
              id="trailer_id_input"
              type="text"
              value={trailerId}
              onChange={(e) => setTrailerId(e.target.value)}
              placeholder="مثال: مقطورة جوانب 2095 أو رقم اللوحة..."
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-black rounded-lg focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none transition-all placeholder:text-slate-500 text-black font-black text-sm min-h-[44px]"
            />
          </div>

          {/* Check-In Date */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="date_in_input" className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-700" />
                <span className="text-black font-black" style={{ fontSize: "18px" }}>تاريخ استلام المركبة</span>
              </label>
              <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300" dir="ltr">
                DD/MM/YYYY
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                id="date_in_input"
                type="text"
                value={dateIn}
                onChange={(e) => {
                  let val = e.target.value;
                  val = val.replace(/[^\d/]/g, "");
                  setDateIn(val);
                }}
                placeholder="DD/MM/YYYY (مثال: 11/10/2026)"
                dir="ltr"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 pl-12 bg-white border-2 border-black rounded-lg focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none transition-all text-black font-black text-sm min-h-[44px] text-center font-mono tracking-wider"
                required
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    if (hiddenDateInputRef.current) {
                      if ('showPicker' in HTMLInputElement.prototype) {
                        hiddenDateInputRef.current.showPicker();
                      } else {
                        hiddenDateInputRef.current.focus();
                      }
                    }
                  } catch {
                    hiddenDateInputRef.current?.focus();
                  }
                }}
                className="absolute left-2 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-black border border-black/40 rounded flex items-center gap-1 text-xs font-bold transition-all cursor-pointer active:scale-95"
                title="فتح التقويم لاختيار التاريخ"
              >
                <Calendar className="w-4 h-4 text-black" />
                <span className="text-[10px] hidden sm:inline font-bold">تقويم</span>
              </button>
              <input
                ref={hiddenDateInputRef}
                type="date"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handleCalendarPick}
              />
            </div>
          </div>
        </div>

        {/* Damage Type (Free text description) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-700" />
            <span className="text-black font-black" style={{ fontSize: "18px" }}>نوع ووصف عطب المركبة المبدئي</span>
          </label>
          <textarea
            id="damage_type_input"
            rows={3}
            value={damageType}
            onChange={(e) => setDamageType(e.target.value)}
            placeholder="يرجى كتابة شكوى السائق أو العطب الملاحظ بالتفصيل (مثال: تسريب هيدروليك، عطل فرامل...)"
            className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-black rounded-lg focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none transition-all placeholder:text-slate-500 text-black font-bold text-sm"
          />
        </div>

        {/* Destination Selection: Workshop vs Parking Lot */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-black text-xs sm:text-sm font-black">
              <Compass className="w-4 h-4 text-blue-600" />
              <span style={{ fontSize: "18px" }}>وجهة وتوجيه المركبة عند الدخول *</span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option 1: Workshop */}
            <button
              type="button"
              id="destination_workshop_btn"
              onClick={() => setDestination("workshop")}
              className={`p-3.5 sm:p-4 rounded-xl border-2 text-right transition cursor-pointer flex items-start gap-3 ${
                destination === "workshop"
                  ? "bg-blue-50/80 border-blue-600 text-blue-950 shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${destination === "workshop" ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 text-slate-500"}`}>
                <Wrench className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-900">توجيه إلى الورشة الفنية</span>
                  {destination === "workshop" && (
                    <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">محدد</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  تدخل مباشرة في طابور الصيانة الفورية للفحص والتشخيص والإصلاح.
                </p>
              </div>
            </button>

            {/* Option 2: Parking Lot */}
            <button
              type="button"
              id="destination_parking_btn"
              onClick={() => setDestination("parking")}
              className={`p-3.5 sm:p-4 rounded-xl border-2 text-right transition cursor-pointer flex items-start gap-3 ${
                destination === "parking"
                  ? "bg-amber-50/80 border-amber-500 text-amber-950 shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${destination === "parking" ? "bg-amber-500 text-white shadow-xs" : "bg-slate-100 text-slate-500"}`}>
                <Warehouse className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-extrabold text-xs sm:text-sm text-slate-900">توجيه إلى موقف المركبات</span>
                  {destination === "parking" && (
                    <span className="bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">محدد</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  توجّه للحظيرة وموقف المركبات والمقطورات لحين طلبها ونقلها للورشة.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Real-time duplicate detected notification banner */}
        {activeDuplicateCard && (
          <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs flex items-center justify-between gap-3 text-amber-950 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-extrabold text-amber-950">
                  تنبيه: هذه المركبة مسجلة مسبقاً وتتواجد حالياً في {activeDuplicateCard.destination === "parking" ? "موقف المركبات والحظيرة" : "الورشة الفنية"}
                </span>
                <span className="text-[11px] text-amber-800 mr-1.5 font-mono">
                  (بطاقة: {activeDuplicateCard.id})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDuplicateModalCard(activeDuplicateCard)}
              className="text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer border border-amber-300"
            >
              عرض التفاصيل
            </button>
          </div>
        )}

        <button
          id="btn_submit_checkin"
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all cursor-pointer shadow-md active:scale-[0.98] disabled:opacity-50 text-xs sm:text-sm min-h-[48px]"
        >
          {isLoading ? (
            <span>جاري إضافة المركبة...</span>
          ) : (
            <>
              <PlusCircle className="w-4 h-4" />
              <span>تسجيل دخول المركبة وإصدار بطاقة صيانة</span>
            </>
          )}
        </button>
      </form>

      {/* Duplicate Vehicle Modal Alert */}
      {duplicateModalCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          dir="rtl"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
            {/* Modal Header */}
            <div className={`p-4 sm:p-5 flex items-start justify-between border-b ${
              duplicateModalCard.destination === "parking"
                ? "bg-amber-50/90 border-amber-200 text-amber-950"
                : "bg-blue-50/90 border-blue-200 text-blue-950"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  duplicateModalCard.destination === "parking"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-blue-600 text-white shadow-xs"
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    تنبيه: المركبة موجودة بالفعل بالنظام!
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    يمنع النظام تكرار إدخال نفس المركبة في نفس الوقت
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateModalCard(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Location Highlight Banner */}
              <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                duplicateModalCard.destination === "parking"
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-blue-50 border-blue-300 text-blue-900"
              }`}>
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  duplicateModalCard.destination === "parking"
                    ? "bg-amber-200/80 text-amber-800"
                    : "bg-blue-200/80 text-blue-800"
                }`}>
                  {duplicateModalCard.destination === "parking" ? (
                    <Warehouse className="w-6 h-6" />
                  ) : (
                    <Wrench className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold block text-slate-500">الموقع الحالي للمركبة</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base font-black text-slate-900">
                      {duplicateModalCard.destination === "parking" ? "موقف المركبات والحظيرة" : "الورشة الفنية (قسم الصيانة)"}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      duplicateModalCard.destination === "parking"
                        ? "bg-amber-500 text-white"
                        : "bg-blue-600 text-white"
                    }`}>
                      نشطة حالياً
                    </span>
                  </div>
                </div>
              </div>

              {/* Existing Card Information Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-500">رقم بطاقة الصيانة القائمة:</span>
                  <span className="font-mono font-black text-sm text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                    {duplicateModalCard.id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">رقم المركبة:</span>
                    <strong className="text-slate-800 font-bold">{duplicateModalCard.vehicle_id || "غير محدد"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">رقم المقطورة:</span>
                    <strong className="text-slate-800 font-bold">{duplicateModalCard.trailer_id || "لا توجد"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">اسم السائق:</span>
                    <strong className="text-slate-800 font-bold">{duplicateModalCard.driver_name || "غير محدد"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">تاريخ الدخول:</span>
                    <strong className="text-slate-800 font-mono font-bold" dir="ltr">
                      {duplicateModalCard.date_in ? duplicateModalCard.date_in.replace("T", " ") : "—"}
                    </strong>
                  </div>
                </div>

                {duplicateModalCard.damage_type && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <span className="text-slate-400 text-[11px] block">العطب أو الشكوى المسجلة:</span>
                    <p className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200 mt-1">
                      {duplicateModalCard.damage_type}
                    </p>
                  </div>
                )}
              </div>

              {/* Caution & Technical Explanation */}
              <div className="text-xs text-slate-600 bg-slate-100/90 p-3 rounded-xl border border-slate-200 leading-relaxed">
                <p>
                  💡 <strong>ملاحظة فنية:</strong> تم إلغاء التسجيل التكراري تلقائياً لمنع ازدواجية السجلات وأوامر الصيانة في التقارير اليومية والشهرية. يمكنك متابعة المركبة مباشرة من بطاقتها أعلاه.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 bg-slate-50/80 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDuplicateModalCard(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                إغلاق النافذة وتعديل الرقم
              </button>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    const target = duplicateModalCard.destination === "parking" ? "parking" : "maintenance";
                    setDuplicateModalCard(null);
                    onNavigateTab(target);
                  }}
                  className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-white text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                    duplicateModalCard.destination === "parking"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {duplicateModalCard.destination === "parking" ? (
                    <>
                      <Warehouse className="w-4 h-4" />
                      <span>الانتقال لموقف المركبات لمتابعتها</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4" />
                      <span>الانتقال لقسم الصيانة لمتابعتها</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
