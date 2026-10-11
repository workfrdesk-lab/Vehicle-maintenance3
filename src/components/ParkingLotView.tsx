/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { MaintenanceCard } from "../types";
import { 
  Warehouse, 
  Truck, 
  Wrench, 
  Search, 
  ArrowRightLeft, 
  Calendar, 
  User, 
  Phone, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Eye, 
  PlusCircle, 
  LayoutGrid, 
  List,
  ChevronLeft,
  X,
  ExternalLink
} from "lucide-react";

interface ParkingLotViewProps {
  cards: MaintenanceCard[];
  onRefresh: () => void;
  driverPhones?: Record<string, string>;
  onNavigateToMaintenance?: (cardId: string) => void;
  onNavigateToCheckIn?: () => void;
}

export default function ParkingLotView({
  cards,
  onRefresh,
  driverPhones = {},
  onNavigateToMaintenance,
  onNavigateToCheckIn
}: ParkingLotViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "truck" | "trailer">("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error"; cardId?: string } | null>(null);
  const [modalCard, setModalCard] = useState<MaintenanceCard | null>(null);

  // Cards currently residing in the Parking Lot / Fleet Yard
  const parkedCards = useMemo(() => {
    return cards.filter(c => c.status !== "completed" && c.destination === "parking");
  }, [cards]);

  // Filtered cards based on search and type filter
  const filteredCards = useMemo(() => {
    return parkedCards.filter(c => {
      // Type filter
      if (filterType === "truck" && (!c.vehicle_id || c.vehicle_id === "—")) return false;
      if (filterType === "trailer" && (!c.trailer_id || c.trailer_id === "—")) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const matchId = (c.id || "").toLowerCase().includes(q);
      const matchVehicle = (c.vehicle_id || "").toLowerCase().includes(q);
      const matchTrailer = (c.trailer_id || "").toLowerCase().includes(q);
      const matchDriver = (c.driver_name || "").toLowerCase().includes(q);
      const matchDamage = (c.damage_type || "").toLowerCase().includes(q);

      return matchId || matchVehicle || matchTrailer || matchDriver || matchDamage;
    });
  }, [parkedCards, searchQuery, filterType]);

  // Statistics
  const stats = useMemo(() => {
    const total = parkedCards.length;
    const trucksCount = parkedCards.filter(c => c.vehicle_id && c.vehicle_id !== "—").length;
    const trailersCount = parkedCards.filter(c => c.trailer_id && c.trailer_id.trim().length > 0 && c.trailer_id !== "—").length;
    const withDamageCount = parkedCards.filter(c => c.damage_type && c.damage_type.trim().length > 0 && c.damage_type !== "—").length;
    return { total, trucksCount, trailersCount, withDamageCount };
  }, [parkedCards]);

  // Action: Transfer vehicle from Parking Lot to Workshop
  const handleTransferToWorkshop = async (card: MaintenanceCard, openMaintenance: boolean = false) => {
    setTransferringId(card.id);
    setNotification(null);

    try {
      const response = await fetch(`/api/cards/${card.id}/transfer-to-workshop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (response.ok) {
        const vehicleIdentifier = card.vehicle_id ? `الشاحنة (${card.vehicle_id})` : `المقطورة (${card.trailer_id || card.id})`;
        setNotification({
          message: `تم توجيه ${vehicleIdentifier} إلى الورشة الفنية بنجاح! أصبحت جاهزة للفحص والصيانة.`,
          type: "success",
          cardId: card.id
        });
        onRefresh();

        if (openMaintenance && onNavigateToMaintenance) {
          setTimeout(() => {
            onNavigateToMaintenance(card.id);
          }, 300);
        }
      } else {
        const data = await response.json();
        setNotification({
          message: data.error || "فشل توجيه المركبة إلى الورشة",
          type: "error"
        });
      }
    } catch (err) {
      setNotification({
        message: "حدث خطأ في الاتصال بالخادم أثناء توجيه المركبة",
        type: "error"
      });
    } finally {
      setTransferringId(null);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "—";
    return dateStr.replace("T", " ");
  };

  const getRelativeTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);

      if (diffDays > 0) return `منذ ${diffDays} يوم`;
      if (diffHrs > 0) return `منذ ${diffHrs} ساعة`;
      return "منذ قليل";
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6" id="parking-lot-view">
      {/* Top Banner and Header */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-sm shrink-0">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">موقف المركبات والحظيرة</h2>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2 py-0.5 rounded-full font-bold">
                  {stats.total} مركبة متوقفة
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة حركة الشاحنات والمقطورات المتوقفة بالحظيرة وتوجيهها للورشة الفنية عند الطلب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
            {onNavigateToCheckIn && (
              <button
                type="button"
                onClick={onNavigateToCheckIn}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>دخول مركبة جديدة</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase">إجمالي الموقف</span>
              <p className="text-xl font-black text-amber-900 font-mono mt-0.5">{stats.total}</p>
            </div>
            <Warehouse className="w-5 h-5 text-amber-500" />
          </div>

          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-blue-800 uppercase">شاحنات بالموقف</span>
              <p className="text-xl font-black text-blue-900 font-mono mt-0.5">{stats.trucksCount}</p>
            </div>
            <Truck className="w-5 h-5 text-blue-500" />
          </div>

          <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-purple-800 uppercase">مقطورات بالموقف</span>
              <p className="text-xl font-black text-purple-900 font-mono mt-0.5">{stats.trailersCount}</p>
            </div>
            <div className="text-purple-600 font-bold text-xs bg-purple-100 px-1.5 py-0.5 rounded">مقطورة</div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-600 uppercase">مع أعطال مسجلة</span>
              <p className="text-xl font-black text-slate-800 font-mono mt-0.5">{stats.withDamageCount}</p>
            </div>
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div 
          className={`p-3.5 sm:p-4 rounded-xl text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn ${
            notification.type === "success" 
              ? "bg-emerald-50 text-emerald-900 border-2 border-emerald-300" 
              : "bg-rose-50 text-rose-900 border-2 border-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification.message}</span>
          </div>

          {notification.cardId && onNavigateToMaintenance && (
            <button
              type="button"
              onClick={() => onNavigateToMaintenance(notification.cardId!)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
            >
              <span>فتح بطاقة الصيانة الآن</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Search & Filter Controls Bar */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الشاحنة، المقطورة، اسم السائق، أو رقم البطاقة..."
            className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              مسح
            </button>
          )}
        </div>

        {/* Filter Pills & View Mode */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-none">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterType === "all" ? "bg-white text-slate-900 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"}`}
            >
              الكل ({parkedCards.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("truck")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterType === "truck" ? "bg-white text-blue-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"}`}
            >
              شاحنات ({stats.trucksCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("trailer")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filterType === "trailer" ? "bg-white text-purple-600 shadow-2xs font-extrabold" : "text-slate-600 hover:text-slate-900"}`}
            >
              مقطورات ({stats.trailersCount})
            </button>
          </div>

          <div className="hidden sm:flex bg-slate-100 p-1 rounded-xl text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === "cards" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-400 hover:text-slate-700"}`}
              title="عرض البطاقات"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === "table" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-400 hover:text-slate-700"}`}
              title="عرض الجدول"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Cards or Table */}
      {filteredCards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-2xs space-y-3">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto border border-amber-200">
            <Warehouse className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            {searchQuery || filterType !== "all" 
              ? "لا توجد نتائج مطابقة لبحثك في موقف المركبات" 
              : "موقف المركبات والحظيرة فارغ حالياً"}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery || filterType !== "all"
              ? "جرب تعديل كلمات البحث أو اختيار تصفية أخرى للوصول إلى المركبة المطلوبة."
              : "لا توجد أي شاحنات أو مقطورات مسجلة في الموقف حالياً؛ جميع المركبات إما دخلت الورشة مباشرة أو تم تسليمها."}
          </p>
          {onNavigateToCheckIn && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onNavigateToCheckIn}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>تسجيل دخول مركبة جديدة وتوجيهها للموقف</span>
              </button>
            </div>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* Cards View (Responsive Grid) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredCards.map((card) => {
            const isTransferring = transferringId === card.id;
            const driverPhone = card.driver_name ? driverPhones[card.driver_name.trim()] : undefined;

            return (
              <div 
                key={card.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-amber-400 transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-4 sm:p-4.5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="bg-amber-100 text-amber-800 p-2 rounded-xl shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {card.id}
                          </span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>في الموقف</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>دخول: {formatDateTime(card.date_in)} ({getRelativeTime(card.date_in)})</span>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setModalCard(card)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      title="معاينة البطاقة الفنية الكاملة"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Vehicle & Trailer Details */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-slate-400" />
                        <span>رقم الشاحنة:</span>
                      </span>
                      <span className="font-extrabold text-slate-900 font-mono text-sm">
                        {card.vehicle_id || "—"}
                      </span>
                    </div>

                    {card.trailer_id && card.trailer_id !== "—" && (
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                        <span className="text-slate-500 font-semibold flex items-center gap-1">
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded font-bold">مقطورة</span>
                          <span>رقم المقطورة:</span>
                        </span>
                        <span className="font-bold text-purple-900 font-mono">
                          {card.trailer_id}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>السائق:</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">
                          {card.driver_name || "—"}
                        </span>
                        {driverPhone && (
                          <a
                            href={`tel:${driverPhone}`}
                            className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 p-1 rounded-md transition"
                            title={`اتصال بالسائق: ${driverPhone}`}
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Complaint / Defect */}
                  {card.damage_type && card.damage_type !== "—" ? (
                    <div className="bg-amber-50/50 rounded-xl p-2.5 border border-amber-100 text-xs">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 mb-0.5">
                        <FileText className="w-3 h-3 text-amber-600" />
                        <span>العطب المشتكى منه:</span>
                      </div>
                      <p className="text-slate-700 line-clamp-2 leading-relaxed">
                        {card.damage_type}
                      </p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic px-1">
                      لا يوجد عطل مسجل (وقوف / مبيت)
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="p-3 sm:p-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTransferToWorkshop(card, false)}
                    disabled={isTransferring}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-50 min-h-[42px]"
                    title="توجيه المركبة من الموقف إلى الورشة الفنية"
                  >
                    {isTransferring ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>توجيه إلى الورشة</span>
                      </>
                    )}
                  </button>

                  {onNavigateToMaintenance && (
                    <button
                      type="button"
                      onClick={() => handleTransferToWorkshop(card, true)}
                      disabled={isTransferring}
                      className="flex items-center justify-center gap-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs min-h-[42px]"
                      title="توجيه إلى الورشة وفتح بطاقة الصيانة والتشخيص مباشرة"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">وبدء الصيانة</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase">
                <tr>
                  <th className="p-3.5">الرقم</th>
                  <th className="p-3.5">الشاحنة / المقطورة</th>
                  <th className="p-3.5">السائق</th>
                  <th className="p-3.5">تاريخ ووقت الدخول</th>
                  <th className="p-3.5">العطب والشكوى</th>
                  <th className="p-3.5 text-center">إجراء التوجيه للورشة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCards.map((card) => {
                  const isTransferring = transferringId === card.id;
                  const driverPhone = card.driver_name ? driverPhones[card.driver_name.trim()] : undefined;

                  return (
                    <tr key={card.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 font-mono font-extrabold text-blue-700">
                        {card.id}
                      </td>
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900 text-sm font-mono">
                          {card.vehicle_id || "—"}
                        </div>
                        {card.trailer_id && card.trailer_id !== "—" && (
                          <div className="text-[10px] text-purple-700 font-bold mt-0.5">
                            مقطورة: {card.trailer_id}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{card.driver_name || "—"}</span>
                          {driverPhone && (
                            <a
                              href={`tel:${driverPhone}`}
                              className="text-emerald-600 bg-emerald-50 p-1 rounded"
                              title={driverPhone}
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {formatDateTime(card.date_in)}
                        <span className="block text-[10px] text-slate-400">
                          {getRelativeTime(card.date_in)}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-xs text-slate-700">
                        {card.damage_type || "—"}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTransferToWorkshop(card, false)}
                            disabled={isTransferring}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>توجيه للورشة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setModalCard(card)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                            title="عرض البطاقة"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card Details Modal */}
      {modalCard && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setModalCard(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-right flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 text-white rounded-xl">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">بيانات بطاقة المركبة بالموقف</h3>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {modalCard.id}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">تاريخ الدخول: {formatDateTime(modalCard.date_in)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalCard(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">رقم الشاحنة:</span>
                  <span className="font-extrabold text-slate-900 font-mono text-sm">{modalCard.vehicle_id || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">رقم المقطورة:</span>
                  <span className="font-extrabold text-purple-900 font-mono text-sm">{modalCard.trailer_id || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">اسم السائق:</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span>{modalCard.driver_name || "—"}</span>
                    {modalCard.driver_name && driverPhones[modalCard.driver_name.trim()] && (
                      <a
                        href={`tel:${driverPhones[modalCard.driver_name.trim()]}`}
                        className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-mono"
                        title={driverPhones[modalCard.driver_name.trim()]}
                      >
                        {driverPhones[modalCard.driver_name.trim()]}
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">الموقع الحالي:</span>
                  <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-block">
                    موقف المركبات والحظيرة
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-600 block mb-1">وصف العطب أو الشكوى المسجلة:</span>
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-medium">
                  {modalCard.damage_type || "لا توجد شكوى مسجلة (وقوف / مبيت)"}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  const c = modalCard;
                  setModalCard(null);
                  handleTransferToWorkshop(c, false);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>توجيه إلى الورشة الفنية</span>
              </button>

              {onNavigateToMaintenance && (
                <button
                  type="button"
                  onClick={() => {
                    const c = modalCard;
                    setModalCard(null);
                    handleTransferToWorkshop(c, true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Wrench className="w-4 h-4" />
                  <span>توجيه وبدء الصيانة</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setModalCard(null)}
                className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
