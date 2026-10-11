/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { MaintenanceCard, PartItem } from "../types";
import { Search, Printer, Calendar, ShieldAlert, CheckCircle, FileSpreadsheet, Eye, MoreHorizontal, Download, Trash2, Clock, EyeOff, X, Wrench, Hammer, Cpu, Plus, Users, UserCheck, CheckCircle2, ClipboardList, SlidersHorizontal, RotateCcw, Filter, Phone, AlertTriangle } from "lucide-react";

// Arabic normalization helper to match various Arabic spellings (e.g., أ, إ, آ, ا and ة, ه and ى, ي and remove tashkeel)
const normalizeArabic = (text?: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[يى]/g, "ي")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .trim();
};

const COMMON_DEFECT_TAGS = [
  "فرامل",
  "هيدروليك",
  "تسريب",
  "كهرباء",
  "محرك",
  "إطارات",
  "هواء",
  "ناقل الحركة"
];

interface RepairItem {
  id: string;
  description: string;
  workers: string[];
}

interface ReportArchiveProps {
  cards: MaintenanceCard[];
  onRefresh: () => void;
  defaultWorkTeams?: string[];
  defaultWorkers?: string[];
  defaultVehicles?: string[];
  defaultDrivers?: string[];
  driverPhones?: Record<string, string>;
  workerPhones?: Record<string, string>;
  targetCardId?: string | null;
  onClearTargetCardId?: () => void;
  isPhoneMode?: boolean;
}

export default function ReportArchive({ 
  cards, 
  onRefresh, 
  defaultWorkTeams = [], 
  defaultWorkers = [],
  defaultVehicles = [],
  defaultDrivers = [],
  driverPhones = {},
  workerPhones = {},
  targetCardId,
  onClearTargetCardId,
  isPhoneMode = false
}: ReportArchiveProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCard, setSelectedCard] = useState<MaintenanceCard | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [printIframeUrl, setPrintIframeUrl] = useState<string>("");

  // Automatically select the targeted card and pre-fill search query when navigating from parts list
  React.useEffect(() => {
    if (targetCardId) {
      setSearchQuery(targetCardId);
      setStatusFilter("all");
      const matchedCard = cards.find(c => c.id === targetCardId);
      if (matchedCard) {
        setSelectedCard(matchedCard);
      }
      if (onClearTargetCardId) {
        onClearTargetCardId();
      }
    }
  }, [targetCardId, cards, onClearTargetCardId]);

  const currentMonthStr = new Date().toISOString().substring(0, 7); // e.g., "2026-06"
  const completedThisMonth = cards.filter(c => {
    if (c.status !== "completed") return false;
    const dateStr = c.date_out || c.date_in;
    return dateStr && dateStr.startsWith(currentMonthStr);
  });

  const triggerMonthlyPrint = (monthStr?: string) => {
    const targetMonth = monthStr || currentMonthStr;
    const url = `/api/reports/monthly/render?month=${targetMonth}`;
    setPrintIframeUrl(url);
    
    setTimeout(() => {
      const iframeElement = document.getElementById("print-iframe") as HTMLIFrameElement;
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.focus();
        iframeElement.contentWindow.print();
      }
    }, 600);
  };

  const [dailyReportDate, setDailyReportDate] = useState(new Date().toISOString().substring(0, 10));

  const triggerDailyPrint = (dateStr?: string) => {
    const targetDate = dateStr || dailyReportDate;
    const url = `/api/reports/daily/render?date=${targetDate}`;
    setPrintIframeUrl(url);
    
    setTimeout(() => {
      const iframeElement = document.getElementById("print-iframe") as HTMLIFrameElement;
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.focus();
        iframeElement.contentWindow.print();
      }
    }, 600);
  };

  // Helper to format date and time to display hours and minutes beautifully
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "—";
    return dateStr.replace("T", " ");
  };

  // Editing mode states
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editDiagnosis, setEditDiagnosis] = useState("");
  const [editParts, setEditParts] = useState("");
  const [editPartsList, setEditPartsList] = useState<PartItem[]>([]);
  const [archiveNewPartName, setArchiveNewPartName] = useState("");
  const [archiveNewPartDate, setArchiveNewPartDate] = useState(new Date().toISOString().split("T")[0]);
  const [archiveNewPartTarget, setArchiveNewPartTarget] = useState<'vehicle' | 'trailer'>('vehicle');
  const [editWorkTeam, setEditWorkTeam] = useState("");
  const [editRepairs, setEditRepairs] = useState<RepairItem[]>([]);
  const [tempCustomWorkers, setTempCustomWorkers] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  // New basic technical data edit states
  const [editVehicleId, setEditVehicleId] = useState("");
  const [editTrailerId, setEditTrailerId] = useState("");
  const [editDriverName, setEditDriverName] = useState("");
  const [editDateIn, setEditDateIn] = useState("");
  const [editDamageType, setEditDamageType] = useState("");
  const [editDateOut, setEditDateOut] = useState("");

  // Advanced Filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterDateType, setFilterDateType] = useState<"in" | "out">("in");
  const [filterDriver, setFilterDriver] = useState("");
  const [filterVehicleId, setFilterVehicleId] = useState("");
  const [filterVehicleType, setFilterVehicleType] = useState<"all" | "vehicle" | "trailer">("all");
  const [filterWorkTeam, setFilterWorkTeam] = useState("");
  const [filterDamage, setFilterDamage] = useState("");

  const resetAdvancedFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterDateType("in");
    setFilterDriver("");
    setFilterVehicleId("");
    setFilterVehicleType("all");
    setFilterWorkTeam("");
    setFilterDamage("");
  };

  // Generate lists of unique items for filters
  const uniqueDriversList = Array.from(
    new Set([
      ...defaultDrivers,
      ...cards.map(c => c.driver_name).filter(Boolean)
    ])
  ).sort();

  const uniqueVehiclesList = Array.from(
    new Set([
      ...defaultVehicles,
      ...cards.map(c => c.vehicle_id).filter(Boolean)
    ])
  ).sort();

  const uniqueWorkTeamsList = Array.from(
    new Set([
      ...defaultWorkTeams,
      ...cards.map(c => c.work_team).filter(Boolean)
    ])
  ).sort();

  const uniqueDamagesList = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => {
      if (c.damage_type && c.damage_type.trim()) {
        set.add(c.damage_type.trim());
      }
    });
    return Array.from(set).sort();
  }, [cards]);

  // Filter cards locally for immediate responsiveness
  const filteredCards = cards.filter((card) => {
    const matchesStatus =
      statusFilter === "all" ||
      card.status === statusFilter;

    // Search query with Arabic letter normalization (matches defects, IDs, vehicles, drivers, parts, etc.)
    const normQuery = normalizeArabic(searchQuery);
    const matchesSearch =
      !normQuery ||
      normalizeArabic(card.id).includes(normQuery) ||
      normalizeArabic(card.vehicle_id).includes(normQuery) ||
      normalizeArabic(card.driver_name).includes(normQuery) ||
      normalizeArabic(card.trailer_id).includes(normQuery) ||
      normalizeArabic(card.damage_type).includes(normQuery) ||
      normalizeArabic(card.diagnosis).includes(normQuery) ||
      normalizeArabic(card.repair_details).includes(normQuery) ||
      normalizeArabic(card.parts).includes(normQuery) ||
      normalizeArabic(card.work_team).includes(normQuery);

    // Dedicated Damage / Defect filter (checks both damage_type and technical diagnosis)
    const matchesDamage = !filterDamage || 
      normalizeArabic(card.damage_type).includes(normalizeArabic(filterDamage)) ||
      normalizeArabic(card.diagnosis).includes(normalizeArabic(filterDamage));

    // Date range filter
    let matchesDate = true;
    if (filterStartDate || filterEndDate) {
      const cardDateStr = filterDateType === "in" ? card.date_in : card.date_out;
      if (!cardDateStr) {
        matchesDate = false;
      } else {
        const cDate = cardDateStr.substring(0, 10);
        if (filterStartDate && cDate < filterStartDate) matchesDate = false;
        if (filterEndDate && cDate > filterEndDate) matchesDate = false;
      }
    }

    // Driver filter
    const matchesDriver = !filterDriver || 
      normalizeArabic(card.driver_name).includes(normalizeArabic(filterDriver));

    // Vehicle ID filter
    const matchesVehicleId = !filterVehicleId || 
      normalizeArabic(card.vehicle_id).includes(normalizeArabic(filterVehicleId)) ||
      (card.trailer_id && normalizeArabic(card.trailer_id).includes(normalizeArabic(filterVehicleId)));

    // Vehicle Type filter
    let matchesVehicleType = true;
    if (filterVehicleType === "vehicle") {
      matchesVehicleType = !!card.vehicle_id && card.vehicle_id !== "—";
    } else if (filterVehicleType === "trailer") {
      matchesVehicleType = !!card.trailer_id && card.trailer_id.trim().length > 0 && card.trailer_id !== "—";
    }

    // Work team filter
    const matchesWorkTeam = !filterWorkTeam || card.work_team === filterWorkTeam;

    return matchesStatus && matchesSearch && matchesDamage && matchesDate && matchesDriver && matchesVehicleId && matchesVehicleType && matchesWorkTeam;
  });

  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    statusFilter,
    filterStartDate,
    filterEndDate,
    filterDateType,
    filterDriver,
    filterVehicleId,
    filterVehicleType,
    filterWorkTeam,
    filterDamage
  ]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
  const paginatedCards = filteredCards.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const renderPagination = (position: "top" | "bottom") => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 3;
    let startPage = Math.max(1, activePage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-2.5 px-3.5 sm:px-6 py-2.5 sm:py-3.5 bg-slate-50/50 border-slate-150 ${position === "top" ? "border-b" : "border-t"}`} dir="rtl">
        <div className="text-xs text-slate-500 font-bold text-center sm:text-right">
          عرض <span className="text-slate-850 font-black">{Math.min(filteredCards.length, startIndex + 1)}</span> إلى{" "}
          <span className="text-slate-850 font-black">{Math.min(filteredCards.length, startIndex + ITEMS_PER_PAGE)}</span> من أصل{" "}
          <span className="text-indigo-650 font-black">{filteredCards.length}</span> بطاقة
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-1">
          {/* First page button */}
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={activePage === 1}
            className={`px-2 py-1 text-[11px] rounded border transition font-bold select-none cursor-pointer ${
              activePage === 1
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95"
            }`}
            title="الصفحة الأولى"
          >
            الأولى
          </button>

          {/* Previous page button */}
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={activePage === 1}
            className={`px-2.5 py-1 text-[11px] rounded border transition font-bold select-none cursor-pointer ${
              activePage === 1
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95"
            }`}
          >
            السابق
          </button>

          {/* First index helper if start is after 1 */}
          {startPage > 1 && (
            <>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                className={`w-7 h-7 flex items-center justify-center text-xs rounded border transition font-bold select-none cursor-pointer ${
                  activePage === 1
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                1
              </button>
              {startPage > 2 && <span className="text-slate-400 px-1 text-xs select-none">...</span>}
            </>
          )}

          {pages.map(page => (
            <button
              type="button"
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-7 h-7 flex items-center justify-center text-xs rounded border transition font-bold select-none cursor-pointer ${
                activePage === page
                  ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {page}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="text-slate-400 px-1 text-xs select-none">...</span>}
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                className={`w-7 h-7 flex items-center justify-center text-xs rounded border transition font-bold select-none cursor-pointer ${
                  activePage === totalPages
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          {/* Next page button */}
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={activePage === totalPages}
            className={`px-2.5 py-1 text-[11px] rounded border transition font-bold select-none cursor-pointer ${
              activePage === totalPages
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95"
            }`}
          >
            التالي
          </button>

          {/* Last page button */}
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={activePage === totalPages}
            className={`px-2 py-1 text-[11px] rounded border transition font-bold select-none cursor-pointer ${
              activePage === totalPages
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-95"
            }`}
            title="الصفحة الأخيرة"
          >
            الأخيرة
          </button>
        </div>
      </div>
    );
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setIsDeleting(null);
        if (selectedCard?.id === id) {
          setSelectedCard(null);
        }
        onRefresh();
      }
    } catch (err) {
      console.error("Error deleting card:", err);
    }
  };

  const triggerPrint = (id: string) => {
    // Generate URL targeting the render endpoint
    const url = `/api/cards/${id}/render`;
    setPrintIframeUrl(url);
    
    // We will build a hidden iframe to print
    setTimeout(() => {
      const iframeElement = document.getElementById("print-iframe") as HTMLIFrameElement;
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.focus();
        iframeElement.contentWindow.print();
      }
    }, 450);
  };

  const handleStartEdit = () => {
    if (!selectedCard) return;
    setEditDiagnosis(selectedCard.diagnosis || "");
    setEditParts(selectedCard.parts || "");
    setEditWorkTeam(selectedCard.work_team || "");
    setEditVehicleId(selectedCard.vehicle_id || "");
    setEditTrailerId(selectedCard.trailer_id || "");
    setEditDriverName(selectedCard.driver_name || "");
    setEditDateIn(selectedCard.date_in || "");
    setEditDamageType(selectedCard.damage_type || "");
    setEditDateOut(selectedCard.date_out || "");
    
    let loadedParts: PartItem[] = [];
    const cardParts = selectedCard.parts || "";
    try {
      if (cardParts.trim().startsWith("[")) {
        const parsed = JSON.parse(cardParts);
        if (Array.isArray(parsed)) {
          loadedParts = parsed
            .filter((item: any) => (item.name || item.description || "").trim().length > 0 && (item.name || item.description || "").trim() !== "[]")
            .map((item: any, idx: number) => ({
              id: item.id || `part_${idx}_${Date.now()}`,
              name: item.name || item.description || "",
              date: item.date || "",
              target: item.target || "vehicle"
            }));
        }
      }
    } catch (e) {
      // ignore
    }

    if (loadedParts.length === 0 && cardParts.trim().length > 0 && cardParts.trim() !== "[]") {
      loadedParts = [
        {
          id: `part_fallback_${Date.now()}`,
          name: cardParts,
          date: selectedCard.date_out || selectedCard.date_in || new Date().toISOString().split("T")[0]
        }
      ];
    }
    setEditPartsList(loadedParts);
    
    // Parse repairs
    let loadedRepairs: RepairItem[] = [];
    const cardRepairDetails = selectedCard.repair_details || "";
    try {
      if (cardRepairDetails.trim().startsWith("[")) {
        const parsed = JSON.parse(cardRepairDetails);
        if (Array.isArray(parsed)) {
          loadedRepairs = parsed
            .filter((item: any) => (item.description || item.action || "").trim().length > 0 && (item.description || item.action || "").trim() !== "[]")
            .map((item: any, idx: number) => ({
              id: item.id || `rep_${idx}_${Date.now()}`,
              description: item.description || item.action || "",
              workers: Array.isArray(item.workers) ? item.workers : (item.worker_name ? [item.worker_name] : (item.worker ? [item.worker] : []))
            }));
        }
      }
    } catch (e) {
      // ignore
    }

    if (loadedRepairs.length === 0 && cardRepairDetails.trim().length > 0 && cardRepairDetails.trim() !== "[]") {
      loadedRepairs = [
        {
          id: `rep_fallback_${Date.now()}`,
          description: cardRepairDetails,
          workers: selectedCard.worker_name ? selectedCard.worker_name.split(/[،,\n\r]+/).map((w: string) => w.trim()).filter((w: string) => w.length > 0) : []
        }
      ];
    }
    setEditRepairs(loadedRepairs);

    // Extract any custom workers
    const currentWorkersFromCard = selectedCard.worker_name 
      ? selectedCard.worker_name.split(/[،,\n\r]+/).map((w: string) => w.trim()).filter((w: string) => w.length > 0)
      : [];
    const loadedCustomWorkers = currentWorkersFromCard.filter(
      (w) => !defaultWorkers.includes(w) && w !== "—" && w !== "لم يحدد"
    );
    setTempCustomWorkers(loadedCustomWorkers);

    setEditError("");
    setEditSuccess("");
    setIsEditingMode(true);
  };

  const handleAutofillFromVehicle = (vNum: string) => {
    if (!vNum || !cards) return;
    const cleanV = vNum.trim().toLowerCase();
    const matching = cards.filter(c => c.id !== selectedCard?.id && c.vehicle_id && c.vehicle_id.trim().toLowerCase() === cleanV);
    if (matching.length === 0) return;
    const latest = [...matching].sort((a, b) => {
      const timeA = new Date(a.date_in).getTime();
      const timeB = new Date(b.date_in).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    })[0];
    if (latest) {
      if (latest.driver_name) setEditDriverName(latest.driver_name);
      if (latest.trailer_id !== undefined) setEditTrailerId(latest.trailer_id || "");
    }
  };

  const handleAutofillFromDriver = (dName: string) => {
    if (!dName || !cards) return;
    const cleanD = dName.trim().toLowerCase();
    const matching = cards.filter(c => c.id !== selectedCard?.id && c.driver_name && c.driver_name.trim().toLowerCase() === cleanD);
    if (matching.length === 0) return;
    const latest = [...matching].sort((a, b) => {
      const timeA = new Date(a.date_in).getTime();
      const timeB = new Date(b.date_in).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id, undefined, { numeric: true });
    })[0];
    if (latest) {
      if (latest.vehicle_id) setEditVehicleId(latest.vehicle_id);
      if (latest.trailer_id !== undefined) setEditTrailerId(latest.trailer_id || "");
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedCard) return;

    // Validate basic technical details
    if (!editVehicleId.trim() && !editTrailerId.trim()) {
      setEditError("الرجاء إدخال رقم المركبة أو رقم المقطورة (أحدهما على الأقل مطلوب)");
      return;
    }
    if (!editDriverName.trim()) {
      setEditError("اسم السائق حقل إجباري");
      return;
    }
    if (!editDateIn) {
      setEditError("تاريخ الدخول حقل إجباري");
      return;
    }

    // Validate repairs - optional if empty, but if there's any text, we validate workers
    const validRepairs = editRepairs.filter(r => r.description.trim().length > 0);

    for (let i = 0; i < validRepairs.length; i++) {
      if (validRepairs[i].workers.length === 0) {
        setEditError(`يرجى تحديد عامل فني واحد على الأقل للعمل رقم ${i + 1}: ("${validRepairs[i].description.substring(0, 20)}...")`);
        return;
      }
    }

    // Gather all workers across all repairs for the worker_name field
    const uniqueWorkers = Array.from(
      new Set(validRepairs.flatMap(r => r.workers))
    ) as string[];
    const allWorkers = uniqueWorkers.filter(w => w && w.trim().length > 0);
    const finalWorkerName = allWorkers.join("، ");

    setIsSaving(true);
    setEditError("");
    setEditSuccess("");

    try {
      const response = await fetch(`/api/cards/${selectedCard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis: editDiagnosis,
          repair_details: validRepairs.length > 0 ? JSON.stringify(validRepairs) : "",
          parts: editPartsList.length > 0 ? JSON.stringify(editPartsList) : "",
          work_team: editWorkTeam,
          worker_name: finalWorkerName,
          vehicle_id: editVehicleId.trim(),
          trailer_id: editTrailerId.trim(),
          driver_name: editDriverName.trim(),
          date_in: editDateIn,
          damage_type: editDamageType.trim(),
          date_out: editDateOut || undefined
        })
      });

      const res = await response.json();
      if (response.ok && res.success) {
        setEditSuccess("تم تحديث تفاصيل الصيانة الفنية بنجاح!");
        setSelectedCard(res.card);
        onRefresh();
        setTimeout(() => {
          setIsEditingMode(false);
          setEditSuccess("");
        }, 1500);
      } else {
        setEditError(res.error || "فشل حفظ تفاصيل الصيانة الفنية");
      }
    } catch (err) {
      console.error(err);
      setEditError("حدث خطأ أثناء محاولة الاتصال بالخادم.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" id="archive-section">
      {/* Header and Reports Export Options */}
      <div className="bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
        {/* Main Title Banner */}
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-400 animate-pulse" />
              <span>نظام التقارير الرقمية وأرشيف الورشة</span>
            </h2>
            <p className="text-xs text-slate-400 font-semibold">
              تصفح، ابحث، عدل واطبع بطاقات الصيانة الفنية والتقارير الدورية للمركبات والمقطورات.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-amber-400 text-[11px] font-bold rounded-lg select-all">
              إجمالي السجلات بالأرشيف: {cards.length} سجل
            </span>
          </div>
        </div>

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-800 bg-slate-950/40">
          {/* Monthly Report Control column */}
          <div className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">التقرير الشهري التراكمي</span>
              <p className="text-xs text-slate-300 font-bold">تقرير الصيانة المكتملة لشهر {currentMonthStr}</p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                id="btn_trigger_monthly_print"
                onClick={() => triggerMonthlyPrint()}
                disabled={completedThisMonth.length === 0}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-extrabold cursor-pointer transition min-h-[40px] ${
                  completedThisMonth.length > 0
                    ? "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
                title="طباعة أو حفظ تقرير الصيانة الشهري كـ PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>تصدير تقرير الشهر ({completedThisMonth.length})</span>
              </button>
              
              <a
                href={`/api/reports/monthly/render?month=${currentMonthStr}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center p-2.5 rounded-lg text-xs font-bold transition border border-slate-800 hover:bg-slate-800 bg-slate-900 text-slate-300 min-h-[40px] min-w-[40px]`}
                title="عرض التقرير المفصل للتصفح وحفظه يدوياً"
              >
                <Eye className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Daily Report Control column */}
          <div className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
            <div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">التقرير اليومي لحركة الورشة</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-300 font-bold shrink-0">تحديد اليوم:</span>
                <input
                  type="date"
                  value={dailyReportDate}
                  onChange={(e) => setDailyReportDate(e.target.value)}
                  className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-bold text-white focus:outline-none focus:border-blue-500 cursor-pointer min-h-[36px]"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                id="btn_trigger_daily_print"
                onClick={() => triggerDailyPrint()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 px-3.5 py-2.5 rounded-lg text-xs font-extrabold cursor-pointer transition min-h-[40px]"
                title="طباعة أو حفظ تقرير الحركة والتشغيل اليومي كـ PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>تصدير التقرير اليومي</span>
              </button>
              
              <a
                href={`/api/reports/daily/render?date=${dailyReportDate}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center p-2.5 rounded-lg text-xs font-bold transition border border-slate-800 hover:bg-slate-800 bg-slate-900 text-slate-300 min-h-[40px] min-w-[40px]`}
                title="عرض التقرير المفصل للتصفح وحفظه يدوياً"
              >
                <Eye className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search & Advanced Filters Trigger */}
          <div className="relative w-full md:w-auto flex flex-col sm:flex-row gap-3 flex-1 items-stretch">
            <div className="relative flex-1 max-w-md">
              <input
                id="archive_search_input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالعطب والشكوى (مثل: فرامل، هيدروليك...) أو المركبة أو السائق..."
                title="امكانية البحث عن عطب، شكوى فنية، رقم بطاقة، مركبة أو سائق"
                className="w-full pr-10 pl-9 py-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800 text-sm"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="مسح نص البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              id="btn_toggle_advanced_filters"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold cursor-pointer transition-all border ${
                showAdvancedFilters || filterStartDate || filterEndDate || filterDriver || filterVehicleId || filterVehicleType !== "all" || filterWorkTeam || filterDamage
                  ? "bg-blue-600 border-blue-600 text-white font-black shadow-sm"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="تصفية متطورة وتقارير وفترات زمنية"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>تصفية متقدمة</span>
              {(filterStartDate || filterEndDate || filterDriver || filterVehicleId || filterVehicleType !== "all" || filterWorkTeam || filterDamage) && (
                <span className="w-2 h-2 rounded-full bg-amber-400 block animate-pulse"></span>
              )}
            </button>
          </div>

          {/* Status filters */}
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto p-1 scrollbar-none">
            <button
              id="btn_filter_all"
              onClick={() => setStatusFilter("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                statusFilter === "all"
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              جميع البطاقات ({cards.length})
            </button>
            
            <button
               id="btn_filter_check_in"
               onClick={() => setStatusFilter("check_in")}
               className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                 statusFilter === "check_in"
                   ? "bg-blue-600 border-blue-600 text-white"
                   : "bg-blue-50/80 border-blue-100 text-blue-700 hover:bg-blue-100"
               }`}
            >
              بانتظار الفحص ({cards.filter((c) => c.status === "check_in").length})
            </button>

            <button
              id="btn_filter_maintenance"
              onClick={() => setStatusFilter("maintenance")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                statusFilter === "maintenance"
                  ? "bg-yellow-500 border-yellow-500 text-slate-950"
                  : "bg-yellow-50/80 border-yellow-105 text-yellow-850 hover:bg-yellow-100"
              }`}
            >
              في الصيانة ({cards.filter((c) => c.status === "maintenance").length})
            </button>

            <button
              id="btn_filter_completed"
              onClick={() => setStatusFilter("completed")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                statusFilter === "completed"
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-emerald-50/80 border-emerald-100 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              جاهزة منتهية ({cards.filter((c) => c.status === "completed").length})
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="bg-slate-50 border border-slate-200/50 p-5 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-4 animate-fadeIn">
            {/* Column 1: Date Range Filter (Span 4) */}
            <div className="md:col-span-4 space-y-2">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span>نطاق التواريخ</span>
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={filterDateType}
                  onChange={(e) => setFilterDateType(e.target.value as "in" | "out")}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 min-h-[38px]"
                >
                  <option value="in">تاريخ الدخول</option>
                  <option value="out">تاريخ الخروج</option>
                </select>
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 min-h-[38px]"
                    placeholder="من تاريخ"
                    title="تاريخ البداية"
                  />
                  <span className="text-slate-400 text-xs font-bold">إلى</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 min-h-[38px]"
                    placeholder="إلى تاريخ"
                    title="تاريخ النهاية"
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Driver Selection Filter (Span 4) */}
            <div className="md:col-span-4 space-y-2">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>اسم السائق (المستفيد)</span>
              </span>
              <select
                value={filterDriver}
                onChange={(e) => setFilterDriver(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 min-h-[38px]"
              >
                <option value="">جميع السائقين في النظام</option>
                {uniqueDriversList.map((driver) => (
                  <option key={driver} value={driver}>
                    {driver}
                  </option>
                ))}
              </select>
            </div>

            {/* Column 3: Vehicle Type & ID Filter (Span 4) */}
            <div className="md:col-span-4 space-y-2">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-blue-500" />
                <span>نوع ورقم المركبة</span>
              </span>
              <div className="flex gap-2.5">
                <select
                  value={filterVehicleId}
                  onChange={(e) => setFilterVehicleId(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 overflow-hidden text-ellipsis min-h-[38px]"
                >
                  <option value="">جميع المركبات / المقطورات</option>
                  {uniqueVehiclesList.map((veh) => (
                    <option key={veh} value={veh}>
                      {veh}
                    </option>
                  ))}
                </select>
                
                <select
                  value={filterVehicleType}
                  onChange={(e) => setFilterVehicleType(e.target.value as "all" | "vehicle" | "trailer")}
                  className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 shrink-0 min-h-[38px]"
                >
                  <option value="all">الكل</option>
                  <option value="vehicle">مركبة</option>
                  <option value="trailer">مقطورة</option>
                </select>
              </div>
            </div>

            {/* Column 4: Defect / Damage Filter (Span 6) */}
            <div className="md:col-span-6 space-y-2">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>البحث عن نوع العطب والشكوى الفنية</span>
              </span>
              <div className="relative">
                <input
                  type="text"
                  value={filterDamage}
                  onChange={(e) => setFilterDamage(e.target.value)}
                  placeholder="اكتب العطب (مثال: فرامل، هيدروليك، تهريب، عطل كهربائي...)"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 min-h-[38px]"
                />
                {filterDamage && (
                  <button
                    type="button"
                    onClick={() => setFilterDamage("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title="مسح فلتر العطب"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Column 5: Work Team Filter (Span 4) */}
            <div className="md:col-span-4 space-y-2">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>فرقة العمل الفنية</span>
              </span>
              <select
                value={filterWorkTeam}
                onChange={(e) => setFilterWorkTeam(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 min-h-[38px]"
              >
                <option value="">جميع فرق العمل</option>
                {uniqueWorkTeamsList.map((wt) => (
                  <option key={wt} value={wt}>
                    {wt}
                  </option>
                ))}
              </select>
            </div>

            {/* Column 6: Reset Button (Span 2) */}
            <div className="md:col-span-2 space-y-2 flex flex-col justify-end">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
                إعادة ضبط الفلاتر
              </span>
              <button
                type="button"
                onClick={resetAdvancedFilters}
                disabled={!filterStartDate && !filterEndDate && !filterDriver && !filterVehicleId && filterVehicleType === "all" && !filterWorkTeam && !filterDamage}
                className={`w-full py-1.5 rounded-lg border transition flex items-center justify-center gap-1.5 text-xs font-bold min-h-[38px] cursor-pointer ${
                  filterStartDate || filterEndDate || filterDriver || filterVehicleId || filterVehicleType !== "all" || filterWorkTeam || filterDamage
                    ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                    : "bg-slate-200/50 border-slate-300 text-slate-400 cursor-not-allowed flex items-center justify-center"
                }`}
                title="إعادة ضبط كافة الفلاتر"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main layout with a spreadsheet grid and card details viewer panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of cards - span all 3 columns to take full width */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">بطاقات الصيانة المسجلة</h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
              وجدنا {filteredCards.length} بطاقة {totalPages > 1 && `(الصفحة ${activePage} من ${totalPages})`}
            </span>
          </div>

          {renderPagination("top")}

          <div className={`overflow-x-auto min-h-[300px] ${isPhoneMode ? 'hidden' : 'hidden md:block'}`}>
            {filteredCards.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">لا توجد بطاقات مطابقة لخيارات البحث</p>
                <p className="text-xs">يرجى تغيير فلاتر التشغيل أو تسجيل بطاقة جديدة.</p>
              </div>
            ) : (
              <table className="w-full text-right text-sm" id="archive_table">
                <thead className="bg-slate-50/75 text-slate-400 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">الرقم</th>
                    <th className="px-5 py-3">المركبة / السائق</th>
                    <th className="px-5 py-3">نوع العطب والشكوى</th>
                    <th className="px-5 py-3 text-center">التاريخ</th>
                    <th className="px-5 py-3 text-center">الحالة</th>
                    <th className="px-5 py-3 text-left">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCards.map((card) => (
                    <tr
                      key={card.id}
                      onClick={() => setSelectedCard(card)}
                      className={`hover:bg-slate-50/60 transition-all cursor-pointer ${
                        selectedCard?.id === card.id ? "bg-slate-50 border-r-2 border-slate-800" : ""
                      }`}
                    >
                      {/* ID Serial */}
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {card.id}
                        </span>
                      </td>

                      {/* Vehicle & Driver */}
                      <td className="px-5 py-4">
                        <div className="font-extrabold text-slate-900 text-sm">{card.vehicle_id}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-semibold">
                          <span>السائق: {card.driver_name}</span>
                          {card.trailer_id && <span className="bg-slate-100 px-1 rounded text-[9px] text-slate-500">ج: {card.trailer_id}</span>}
                        </div>
                      </td>

                      {/* Damage / Defect */}
                      <td className="px-5 py-4 max-w-[240px]">
                        {card.damage_type ? (
                          <div 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50/80 text-amber-950 border border-amber-200/80 truncate max-w-full"
                            title={`العطب: ${card.damage_type}`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{card.damage_type}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs font-normal">لا توجد شكوى</span>
                        )}
                      </td>

                      {/* Check-In Date */}
                      <td className="px-5 py-4 text-center text-[11px] text-slate-400 font-bold font-mono">
                        <div>د: {formatDateTime(card.date_in)}</div>
                        {card.date_out && <div className="text-[10px] text-emerald-600 font-bold mt-0.5">خ: {formatDateTime(card.date_out)}</div>}
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-4 text-center">
                        {card.status === "check_in" && card.destination === "parking" ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            بموقف المركبات
                          </span>
                        ) : card.status === "check_in" ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            انتظار الفحص
                          </span>
                        ) : null}
                        {card.status === "maintenance" && (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-850 border border-yellow-105">
                            تحت صيانة الورشة
                          </span>
                        )}
                        {card.status === "completed" && (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            جاهزة وخارجة
                          </span>
                        )}
                      </td>

                      {/* Controls and Direct printing/PDF options */}
                      <td className="px-5 py-4 text-left" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <button
                            title="عرض التفاصيل"
                            onClick={() => setSelectedCard(card)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-1.5 rounded transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            title="طباعة البطاقة مباشرة"
                            onClick={() => triggerPrint(card.id)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-1.5 rounded transition-all cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            title="حذف السجل"
                            onClick={() => setIsDeleting(card.id)}
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile View: Beautifully designed card list instead of crammed table */}
          <div className={`${isPhoneMode ? 'block' : 'block md:hidden'} min-h-[250px] space-y-3 p-1`}>
            {filteredCards.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600 text-xs">لا توجد بطاقات مطابقة لخيارات البحث</p>
              </div>
            ) : (
              paginatedCards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className={`bg-white p-4 rounded-xl border transition-all active:scale-[0.99] flex flex-col gap-3 cursor-pointer ${
                    selectedCard?.id === card.id 
                      ? "border-blue-500 ring-1 ring-blue-500/30 bg-blue-50/5 shadow-xs" 
                      : "border-slate-200 hover:border-slate-300 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <span className="font-mono font-bold text-slate-950 bg-slate-100 px-2 py-0.5 rounded text-xs">
                      # {card.id}
                    </span>
                    <div>
                      {card.status === "check_in" && card.destination === "parking" ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          بموقف المركبات
                        </span>
                      ) : card.status === "check_in" ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          انتظار الفحص
                        </span>
                      ) : null}
                      {card.status === "maintenance" && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-yellow-50 text-yellow-850 border border-yellow-105">
                          تحت صيانة الورشة
                        </span>
                      )}
                      {card.status === "completed" && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          جاهزة وخارجة
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vehicle details */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">المركبة:</span>
                      <span className="font-extrabold text-slate-900">{card.vehicle_id}</span>
                    </div>
                    {card.trailer_id && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">المقطورة:</span>
                        <span className="font-bold text-slate-700">{card.trailer_id}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">اسم السائق:</span>
                      <span className="font-bold text-slate-800">{card.driver_name}</span>
                    </div>
                  </div>

                  {/* Defect Description */}
                  {card.damage_type && (
                    <div className="p-2 bg-amber-50/80 rounded-lg border border-amber-200/70 text-xs flex items-start gap-1.5 text-amber-950">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-amber-800 font-bold block">نوع العطب والشكوى:</span>
                        <span className="font-bold">{card.damage_type}</span>
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="text-[10px] text-slate-500 font-bold font-mono bg-slate-50/80 p-2.5 rounded-lg space-y-1 border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">تاريخ الدخول:</span>
                      <span>{formatDateTime(card.date_in)}</span>
                    </div>
                    {card.date_out && (
                      <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200/40 pt-1 mt-1">
                        <span>تاريخ الخروج:</span>
                        <span>{formatDateTime(card.date_out)}</span>
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex gap-2 pt-1 border-t border-slate-50" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedCard(card)}
                      className="flex-1 flex items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-lg border border-slate-200 text-[11px] font-extrabold transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>عرض التفاصيل</span>
                    </button>
                    
                    <button
                      onClick={() => triggerPrint(card.id)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg border border-blue-100 text-[11px] font-bold transition cursor-pointer flex items-center justify-center"
                      title="طباعة مباشرة"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setIsDeleting(card.id)}
                      className="text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg border border-rose-100 text-[11px] font-bold transition cursor-pointer flex items-center justify-center"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {renderPagination("bottom")}
        </div>

        {/* Right Side: Selected card details panel - dynamic as a stunning popup modal overlay */}
        <div 
          className={selectedCard 
            ? "fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-40 animate-fadeIn" 
            : "hidden"
          } 
          id="card-details-panel"
          style={{ direction: 'rtl' }}
          onClick={() => { setSelectedCard(null); setIsEditingMode(false); }}
        >
          {selectedCard ? (
            <div 
              className="bg-white rounded-xl sm:rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col relative max-h-[94vh] sm:max-h-[90vh] overflow-hidden p-4 sm:p-6 text-right"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative top accent line */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              
              <div className="space-y-6 flex flex-col h-full overflow-y-auto pr-1">
              {/* Card Meta Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">تفاصيل بطاقة الصيانة</span>
                  <h4 className="text-sm font-extrabold text-slate-900 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100 inline-block">
                    # {selectedCard.id}
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isEditingMode && (
                    <button
                      onClick={handleStartEdit}
                      className="flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition duration-150 cursor-pointer"
                      title="تعديل تفاصيل الصيانة الفنية بحد ذاتها"
                    >
                      <Wrench className="w-3 h-3 text-indigo-600" />
                      <span>تعديل الصيانة</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedCard(null);
                      setIsEditingMode(false);
                    }}
                    className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-md transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

                {isEditingMode ? (
                  /* Edit Form */
                  <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[500px] border-b border-slate-100 pb-4">
                    {/* Edit Error / Success alerts */}
                    {editError && (
                      <div className="p-2.5 bg-rose-50 border border-slate-200 text-rose-800 rounded-lg text-[11px] font-bold">
                        {editError}
                      </div>
                    )}
                    {editSuccess && (
                       <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-850 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                         <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                         <span>{editSuccess}</span>
                       </div>
                    )}

                    {/* Basic Technical details block */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/50 space-y-3">
                      <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider pb-1.5 border-b border-slate-200">البيانات الفنية الأساسية (قابلة للتعديل)</span>
                      
                      {/* Vehicle and Trailer rows */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[9.5px] font-bold text-slate-400">رقم المركبة</label>
                            {editVehicleId.trim() && (
                              <button
                                type="button"
                                onClick={() => handleAutofillFromVehicle(editVehicleId)}
                                className="text-[9px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                title="تعبئة السائق والمقطورة تلقائياً من آخر تسجيل دخول لهذه المركبة"
                              >
                                ملء السائق والمقطورة من آخر دخول
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            list="edit_archive_vehicles"
                            value={editVehicleId}
                            onChange={(e) => setEditVehicleId(e.target.value)}
                            placeholder="رقم المركبة..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium focus:outline-none focus:border-blue-500 text-slate-800"
                          />
                          <datalist id="edit_archive_vehicles">
                            {defaultVehicles.map(v => (
                              <option key={v} value={v} />
                            ))}
                          </datalist>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold text-slate-400">رقم المقطورة</label>
                          <input
                            type="text"
                            value={editTrailerId}
                            onChange={(e) => setEditTrailerId(e.target.value)}
                            placeholder="رقم المقطورة..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium focus:outline-none focus:border-blue-500 text-slate-800"
                          />
                        </div>
                      </div>

                      {/* Driver & Date In */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[9.5px] font-bold text-slate-400">اسم السائق</label>
                            {editDriverName.trim() && (
                              <button
                                type="button"
                                onClick={() => handleAutofillFromDriver(editDriverName)}
                                className="text-[9px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                title="تعبئة المركبة والمقطورة تلقائياً من آخر تسجيل دخول لهذا السائق"
                              >
                                ملء المركبة والمقطورة من آخر دخول
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            list="edit_archive_drivers"
                            value={editDriverName}
                            onChange={(e) => setEditDriverName(e.target.value)}
                            placeholder="اسم السائق..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium focus:outline-none focus:border-blue-500 text-slate-800"
                          />
                          <datalist id="edit_archive_drivers">
                            {defaultDrivers.map(d => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold text-slate-400">تاريخ الدخول</label>
                          <input
                            type="datetime-local"
                            value={editDateIn}
                            onChange={(e) => setEditDateIn(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium focus:outline-none focus:border-blue-500 text-slate-800"
                          />
                        </div>
                      </div>

                      {/* Damage Type */}
                      <div className="space-y-1">
                        <label className="block text-[9.5px] font-bold text-slate-400">طبيعة العطب الشاكي</label>
                        <input
                          type="text"
                          value={editDamageType}
                          onChange={(e) => setEditDamageType(e.target.value)}
                          placeholder="مثلاً: صوت بالفرامل..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium focus:outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>

                      {/* Conditional Date Out */}
                      {(selectedCard.status === "completed" || editDateOut) && (
                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold text-slate-400">تاريخ الخروج المعتمد</label>
                          <input
                            type="datetime-local"
                            value={editDateOut}
                            onChange={(e) => setEditDateOut(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium focus:outline-none focus:border-blue-500 text-slate-800"
                          />
                        </div>
                      )}
                    </div>

                    {/* General Diagnosis */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-blue-500" />
                        <span>تشخيص الميكانيكي الفني العام للمركبة</span>
                      </label>
                      <textarea
                        rows={2}
                        value={editDiagnosis}
                        onChange={(e) => setEditDiagnosis(e.target.value)}
                        placeholder="تشخيص المهندس بدقة..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all text-slate-800 text-xs font-semibold"
                      />
                    </div>

                    {/* Replaced Parts List-based Layout in archive edit */}
                    <div className="space-y-2.5 bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5 border-dashed">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>قطع الغيار المستبدلة</span>
                        </label>
                        <span className="text-[9px] text-slate-400 font-bold bg-slate-200/50 px-1.5 py-0.5 rounded-full">
                          {editPartsList.length} قطع مسجلة
                        </span>
                      </div>

                      {/* Add new part row inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-lg border border-slate-200/40">
                        <div className="sm:col-span-5 space-y-1">
                          <label className="text-[8.5px] font-bold text-slate-400">اسم قطعة الغيار</label>
                          <input
                            type="text"
                            value={archiveNewPartName}
                            onChange={(e) => setArchiveNewPartName(e.target.value)}
                            placeholder="اسم القطعة..."
                            className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold focus:outline-none focus:bg-white text-slate-800"
                          />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[8.5px] font-bold text-slate-400">التركيب في</label>
                          <select
                            value={archiveNewPartTarget}
                            onChange={(e) => setArchiveNewPartTarget(e.target.value as 'vehicle' | 'trailer')}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold focus:outline-none focus:bg-white text-slate-800"
                          >
                            <option value="vehicle">المركبة</option>
                            <option value="trailer">المقطورة</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[8.5px] font-bold text-slate-400">تاريخ الاستبدال</label>
                          <input
                            type="date"
                            value={archiveNewPartDate}
                            onChange={(e) => setArchiveNewPartDate(e.target.value)}
                            className="w-full px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-semibold focus:outline-none focus:bg-white text-slate-800"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (!archiveNewPartName.trim()) return;
                              const newItem: PartItem = {
                                id: `part_${Date.now()}_${Math.random()}`,
                                name: archiveNewPartName.trim(),
                                date: archiveNewPartDate,
                                target: archiveNewPartTarget
                              };
                              setEditPartsList(prev => [...prev, newItem]);
                              setArchiveNewPartName("");
                            }}
                            className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1"
                          >
                            <span>+ إضافة</span>
                          </button>
                        </div>
                      </div>

                      {/* Installed parts list */}
                      {editPartsList.length > 0 ? (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {editPartsList.map((part, index) => (
                            <div
                              key={part.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-2.5 py-1.5 border border-slate-200 rounded text-[11px] hover:border-slate-300 transition"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold bg-slate-100 text-slate-500 w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                                  {index + 1}
                                </span>
                                <span className="font-bold text-slate-800">{part.name}</span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <select
                                  value={part.target || "vehicle"}
                                  onChange={(e) => {
                                    const val = e.target.value as 'vehicle' | 'trailer';
                                    setEditPartsList(prev => prev.map(p => p.id === part.id ? { ...p, target: val } : p));
                                  }}
                                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-150 rounded text-[10px] text-slate-600 font-bold focus:outline-none"
                                >
                                  <option value="vehicle">المركبة</option>
                                  <option value="trailer">المقطورة</option>
                                </select>
                                <input
                                  type="date"
                                  value={part.date}
                                  onChange={(e) => {
                                    const updatedVal = e.target.value;
                                    setEditPartsList(prev => prev.map(p => p.id === part.id ? { ...p, date: updatedVal } : p));
                                  }}
                                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-500 font-mono hover:bg-white focus:bg-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditPartsList(prev => prev.filter(p => p.id !== part.id));
                                  }}
                                  className="text-rose-550 hover:text-rose-750 hover:bg-rose-50 p-1 rounded transition shrink-0 cursor-pointer"
                                  title="إزالة قطعة الغيار"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-2 bg-white border border-dashed border-slate-200 rounded text-slate-400 text-[11px]">
                          لا توجد أي قطع مسجلة.
                        </div>
                      )}
                    </div>

                    {/* Repairs list */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Hammer className="w-3.5 h-3.5 text-yellow-500" />
                          <span>أعمال وإصلاحات الأعطال التفصيلية</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditRepairs(prev => [
                              ...prev,
                              { id: `rep_${Date.now()}_${Math.random()}`, description: "", workers: [] }
                            ]);
                          }}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[10px] px-2 py-1 rounded cursor-pointer"
                        >
                          + إضافة عطب جديد
                        </button>
                      </div>

                      <div className="space-y-3">
                        {editRepairs.map((repair, index) => {
                          const allAvailableWorkers = Array.from(new Set([...defaultWorkers, ...tempCustomWorkers]));
                          return (
                            <div key={repair.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 relative text-right">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50/75 px-1.5 py-0.5 rounded border border-blue-100">
                                  العطب رقم {index + 1}
                                </span>
                                {editRepairs.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditRepairs(prev => prev.filter(r => r.id !== repair.id));
                                    }}
                                    className="text-rose-600 hover:bg-rose-50 p-1 rounded cursor-pointer"
                                    title="إزالة هذا العطب"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <label className="text-[9.5px] font-bold text-slate-400 block">وصف الإجراء والاصلاح للعملية:</label>
                                  <textarea
                                    rows={2}
                                    value={repair.description}
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      setEditRepairs(prev => prev.map(r => r.id === repair.id ? { ...r, description: newVal } : r));
                                    }}
                                    placeholder="موازنة العجلات، تبديل الفرامل..."
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-[11px] font-medium focus:outline-none focus:border-blue-500 text-slate-800"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[9.5px] font-bold text-slate-400 block">الفنيين المنفذين للإصلاح:</label>
                                  <div className="bg-white border border-slate-200 rounded p-2 min-h-[80px] space-y-2">
                                    <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1">
                                      {allAvailableWorkers.map((worker) => {
                                        const isChecked = repair.workers.includes(worker);
                                        return (
                                          <label key={worker} className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer select-none">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                setEditRepairs(prev => prev.map(r => {
                                                  if (r.id === repair.id) {
                                                    const has = r.workers.includes(worker);
                                                    return {
                                                      ...r,
                                                      workers: has ? r.workers.filter(w => w !== worker) : [...r.workers, worker]
                                                    };
                                                  }
                                                  return r;
                                                }));
                                              }}
                                              className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                                            />
                                            <span className="font-semibold text-slate-700">{worker}</span>
                                          </label>
                                        );
                                      })}
                                    </div>

                                    <div className="flex gap-1.5 pt-1.5 border-t border-slate-100">
                                      <input
                                        type="text"
                                        id={`edit_archive_custom_worker_${repair.id}`}
                                        placeholder="أدخل اسم فني آخر..."
                                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-medium flex-1 focus:bg-white focus:outline-none"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const val = (e.target as HTMLInputElement).value.trim();
                                            if (val) {
                                              if (!tempCustomWorkers.includes(val) && !defaultWorkers.includes(val)) {
                                                setTempCustomWorkers(prev => [...prev, val]);
                                              }
                                              setEditRepairs(prev => prev.map(r => {
                                                if (r.id === repair.id && !r.workers.includes(val)) {
                                                  return { ...r, workers: [...r.workers, val] };
                                                }
                                                return r;
                                              }));
                                              (e.target as HTMLInputElement).value = "";
                                            }
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const el = document.getElementById(`edit_archive_custom_worker_${repair.id}`) as HTMLInputElement;
                                          if (el) {
                                            const val = el.value.trim();
                                            if (val) {
                                              if (!tempCustomWorkers.includes(val) && !defaultWorkers.includes(val)) {
                                                setTempCustomWorkers(prev => [...prev, val]);
                                              }
                                              setEditRepairs(prev => prev.map(r => {
                                                if (r.id === repair.id && !r.workers.includes(val)) {
                                                  return { ...r, workers: [...r.workers, val] };
                                                }
                                                return r;
                                              }));
                                              el.value = "";
                                            }
                                          }
                                        }}
                                        className="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        إضافة
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-4 text-xs font-medium">
                  {/* Basic Info Block */}
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wider pb-1.5 border-b border-slate-100">البيانات الفنية الأساسية</span>
                    <div className="flex justify-between">
                      <span className="text-slate-400">رقم المركبة:</span>
                      <span className="text-slate-850 font-bold">{selectedCard.vehicle_id}</span>
                    </div>
                    {selectedCard.trailer_id && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">رقم المقطورة:</span>
                        <span className="text-slate-800">{selectedCard.trailer_id}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">اسم السائق:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-850 font-bold">{selectedCard.driver_name}</span>
                        {selectedCard.driver_name && driverPhones[selectedCard.driver_name.trim()] && (
                          <a
                            href={`tel:${driverPhones[selectedCard.driver_name.trim()]}`}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold transition shadow-2xs"
                            dir="ltr"
                            title="اتصال هاتفي مباشر بالسائق"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{driverPhones[selectedCard.driver_name.trim()]}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">تاريخ الدخول:</span>
                      <span className="text-slate-800 font-mono font-bold">{formatDateTime(selectedCard.date_in)}</span>
                    </div>
                    {selectedCard.damage_type && (
                      <div className="pt-1.5 text-right">
                        <span className="text-slate-400">طبيعة العطب الشاكي:</span>
                        <p className="text-slate-700 bg-white border border-slate-200 p-2 rounded-lg mt-1 font-normal break-words leading-relaxed">
                          {selectedCard.damage_type}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Maintenance Log Block */}
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <span className="block font-bold text-slate-400 text-[10px] uppercase tracking-wider pb-1.5 border-b border-slate-100">الأعمال وقطع الغيار المعتمدة</span>
                    
                    <div className="space-y-2.5">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold">تشخيص الميكانيكي:</span>
                        <p className="text-slate-700 mt-0.5 max-h-20 overflow-y-auto font-normal break-words bg-white p-2 rounded border border-slate-150 leading-relaxed text-xs">
                          {selectedCard.diagnosis || "لا يوجد تشخيص مسجل"}
                        </p>
                      </div>
                      
                                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold">القطع المستبدلة:</span>
                        <div className="bg-emerald-50/20 text-emerald-955 border border-emerald-100/75 p-2.5 rounded-lg mt-0.5 max-h-32 overflow-y-auto">
                          {(() => {
                            const partsText = selectedCard.parts || "";
                            if (!partsText || partsText.trim() === "[]" || partsText.trim() === "") {
                              return <span className="text-slate-400 text-xs font-medium">لا توجد قطع مسجلة</span>;
                            }
                            try {
                              if (partsText.trim().startsWith("[")) {
                                const parsed = JSON.parse(partsText);
                                if (Array.isArray(parsed)) {
                                  const validItems = parsed.filter((item: any) => (item.name || item.description || "").trim().length > 0 && (item.name || item.description || "").trim() !== "[]");
                                  if (validItems.length > 0) {
                                    return (
                                      <ul className="space-y-1.5 list-disc pr-4 text-xs font-bold text-slate-900">
                                        {validItems.map((item: any, idx: number) => (
                                          <li key={idx}>
                                            <span className="text-slate-800 font-extrabold">{item.name || item.description}</span>
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black mr-1.5 ${
                                              item.target === "trailer"
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-blue-100 text-blue-800"
                                            }`}>
                                              {item.target === "trailer" ? "المقطورة" : "المركبة"}
                                            </span>
                                            {item.date && (
                                              <span className="text-[10px] text-slate-500 font-normal mr-1.5 font-mono">
                                                (تاريخ الاستبدال: {item.date})
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  }
                                  return <span className="text-slate-400 text-xs font-medium">لا توجد قطع مسجلة</span>;
                                }
                              }
                            } catch (e) {
                              // ignore
                            }
                            if (partsText.trim() === "[]") {
                              return <span className="text-slate-400 text-xs font-medium">لا توجد قطع مسجلة</span>;
                            }
                            return <p className="text-xs font-semibold whitespace-pre-wrap leading-relaxed">{partsText}</p>;
                          })()}
                        </div>
                      </div>

                      {selectedCard.repair_details && selectedCard.repair_details.trim() !== "[]" && selectedCard.repair_details.trim() !== "" && (() => {
                        const originalText = selectedCard.repair_details;
                        let isJson = false;
                        let parsedRepairs: any[] = [];
                        try {
                          if (originalText.trim().startsWith("[")) {
                            const parsed = JSON.parse(originalText);
                            if (Array.isArray(parsed)) {
                              parsedRepairs = parsed.filter((r: any) => (r.description || r.action || "").trim().length > 0 && (r.description || r.action || "").trim() !== "[]");
                              if (parsedRepairs.length > 0) {
                                isJson = true;
                              }
                            }
                          }
                        } catch (e) {
                          // ignore
                        }

                        if (isJson) {
                          return (
                            <div className="space-y-2">
                              <span className="text-slate-400 text-[10px] uppercase font-bold">الأعطال وإجراءات الإصلاح المفصلة:</span>
                              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                {parsedRepairs.map((rep: any, idx: number) => (
                                  <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-150 space-y-1">
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="text-slate-700 font-semibold text-[11px] leading-relaxed break-words flex-1">
                                        <span className="text-blue-600 font-bold">العطب {idx + 1}: </span>
                                        {rep.description || rep.action || "—"}
                                      </div>
                                    </div>
                                    {rep.workers && Array.isArray(rep.workers) && rep.workers.length > 0 && (
                                      <div className="flex flex-wrap gap-1 items-center pt-1 border-t border-dashed border-slate-100">
                                        <span className="text-slate-450 text-[9px] font-bold">المنفذين:</span>
                                        {rep.workers.map((w: string, widx: number) => (
                                          <span key={widx} className="bg-yellow-50 text-yellow-850 border border-yellow-200 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                                            <span>{w}</span>
                                            {workerPhones[w] && (
                                              <a
                                                href={`tel:${workerPhones[w]}`}
                                                className="text-amber-700 hover:text-amber-900 font-mono"
                                                dir="ltr"
                                                title={`اتصال بالفني: ${workerPhones[w]}`}
                                              >
                                                ({workerPhones[w]})
                                              </a>
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase font-bold">إجراءات إصلاح العطب:</span>
                              <p className="text-slate-700 mt-0.5 max-h-20 overflow-y-auto font-normal break-words bg-white p-2 rounded border border-slate-150 leading-relaxed text-xs">
                                {originalText}
                              </p>
                            </div>
                          );
                        }
                      })()}

                      <div className="flex justify-between pt-1 border-t border-slate-100/65 mt-2 lg:pt-2">
                        <span className="text-slate-400 font-semibold">العامل الفني المنفذ:</span>
                        <span className="text-slate-900 font-bold bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 text-[10px]">{selectedCard.worker_name || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Check-Out / Signatures Block */}
                  {selectedCard.status === "completed" ? (
                    <div className="bg-emerald-50/20 border border-emerald-100 p-3 rounded-xl space-y-2">
                      <span className="block font-bold text-emerald-800 text-[10px] uppercase tracking-wider pb-1 border-b border-emerald-100">مرحلة الخروج والاعتماد النهائي</span>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>تاريخ الخروج المعتمد:</span>
                        <span className="font-mono font-bold text-emerald-800">{formatDateTime(selectedCard.date_out)}</span>
                      </div>
                      <div className="text-[11px] space-y-1 block mt-2 text-slate-600 border-t border-dashed border-emerald-100/60 pt-2">
                        <div className="flex justify-between">
                          <span>مسؤول الورشة المعتمد:</span>
                          <span className="font-bold text-slate-900">{selectedCard.signature_manager}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50/50 border border-yellow-100 p-3.5 rounded-xl text-center text-xs">
                      <Clock className="w-4 h-4 text-yellow-600 mx-auto mb-1 animate-pulse" />
                      <span className="font-bold text-yellow-850 text-[11px]">
                        هذه المركبة لا تزال قيد الانتظار أو العمل الفني بالداخل.
                      </span>
                    </div>
                  )}
                </div>
                )}

                {/* PDF Action buttons */}
                <div className="pt-4 border-t border-slate-100 space-y-2 mt-6">
                  {isEditingMode ? (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-extrabold text-white py-2 rounded-lg text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isSaving ? "جاري الحفظ..." : "حفظ التغييرات الفنية"}
                      </button>
                      <button
                        onClick={() => setIsEditingMode(false)}
                        disabled={isSaving}
                        className="px-4 bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 py-2 rounded-lg text-xs transition cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <>
                  <button
                    id="btn_print_view_primary"
                    onClick={() => triggerPrint(selectedCard.id)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold text-white py-2 px-4 rounded-lg text-xs transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة بطاقة الصيانة الفنية</span>
                  </button>
                  <a
                    href={`/api/cards/${selectedCard.id}/render`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg text-xs transition-all text-center block border border-slate-200/50"
                  >
                    <span>فتح في نافذة مستقلة للتحميل كـ PDF</span>
                  </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-slate-400 space-y-2 my-auto">
              <EyeOff className="w-12 h-12 mx-auto text-slate-200" />
              <p className="font-semibold text-slate-600">حدد بطاقة من الجدول</p>
              <p className="text-[11px]">المس أي بطاقة في جدول الصيانة يساراً لعرض تفاصيلها التفصيلية والاعتمادات هنا.</p>
            </div>
          )}
        </div>
      </div>

      {/* Deletion Confirmation Dialog Modal Overlay */}
      {isDeleting && (() => {
        const cardToDelete = cards.find(c => c.id === isDeleting);
        if (!cardToDelete) return null;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" style={{ direction: 'rtl' }}>
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative overflow-hidden">
              {/* Decorative top accent line */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500"></div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 rounded-xl text-rose-600 shrink-0">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                
                <div className="space-y-2 text-right flex-1">
                  <h3 className="text-base font-black text-slate-900">
                    تأكيد حذف سجل الصيانة
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    هل أنت متأكد من رغبتك في حذف بطاقة الصيانة الفنية بشكل نهائي؟ سيتم مسح هذا السجل من خوادم النظام وقاعدة البيانات، ولا يمكن التراجع عن هذا القرار بعد تأكيده.
                  </p>
                </div>
              </div>

              {/* Card Meta Details Preview */}
              <div className="my-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/65 font-medium space-y-2 text-right">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">رقم السجل:</span>
                  <span className="font-mono font-bold text-slate-850"># {cardToDelete.id}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">رقم المركبة الشاحنة:</span>
                  <span className="font-black text-slate-800">{cardToDelete.vehicle_id}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">اسم السائق (المستفيد):</span>
                  <span className="font-bold text-slate-800">{cardToDelete.driver_name}</span>
                </div>
                {cardToDelete.damage_type && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold">العطب الشاكي:</span>
                    <span className="text-slate-700 max-w-[200px] truncate text-left font-semibold">{cardToDelete.damage_type}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">تاريخ الدخول:</span>
                  <span className="text-slate-755 font-mono text-[10.5px] font-bold">{formatDateTime(cardToDelete.date_in)}</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDelete(cardToDelete.id)}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-2.5 rounded-lg transition duration-155 cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm shadow-rose-105"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تأكيد الحذف النهائي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleting(null)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-750 font-bold text-xs py-2.5 rounded-lg transition duration-155 cursor-pointer text-center"
                >
                  تراجع عن الأمر
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hidden print iframe for seamless rendering of the print template */}
      <iframe
        id="print-iframe"
        src={printIframeUrl || undefined}
        style={{ position: 'absolute', width: '0', height: '0', border: 'none', opacity: 0, pointerEvents: 'none' }}
        title="طباعة بطاقة صيانة المركبة"
      />
    </div>
  );
}
