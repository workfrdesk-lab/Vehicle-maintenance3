import React, { useState } from "react";
import { MaintenanceCard, PartItem } from "../types";
import TechnicalCardModal, { ProfileType } from "./TechnicalCardModal";
import { 
  Wrench, 
  Search, 
  Calendar, 
  Truck, 
  Users, 
  Printer, 
  Layers, 
  FileText,
  Bookmark,
  TrendingUp,
  Download,
  AlertCircle,
  X,
  Eye,
  CheckCircle,
  Clock,
  UserCheck,
  Hammer,
  FileSpreadsheet
} from "lucide-react";

interface ReplacedPartsListProps {
  cards: MaintenanceCard[];
  onNavigateToCard?: (cardId: string) => void;
  driverPhones?: Record<string, string>;
  workerPhones?: Record<string, string>;
  isPhoneMode?: boolean;
}

interface FlattenedPart {
  partId: string;
  partName: string;
  partDate: string;
  partTarget?: 'vehicle' | 'trailer';
  cardId: string;
  vehicleId: string;
  trailerId: string;
  driverName: string;
  workTeam: string;
  workerName: string;
  status: string;
}

export default function ReplacedPartsList({ 
  cards, 
  onNavigateToCard,
  driverPhones = {},
  workerPhones = {},
  isPhoneMode = false
}: ReplacedPartsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterVehicle, setFilterVehicle] = useState("");
  const [selectedCard, setSelectedCard] = useState<MaintenanceCard | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<{ type: ProfileType; name: string } | null>(null);
  const [printIframeUrl, setPrintIframeUrl] = useState<string>("");

  const triggerPrintCard = (id: string) => {
    const url = `/api/cards/${id}/render`;
    setPrintIframeUrl(url);
    setTimeout(() => {
      const iframeElement = document.getElementById("parts-print-iframe") as HTMLIFrameElement;
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.focus();
        iframeElement.contentWindow.print();
      }
    }, 450);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "—";
    return dateStr.replace("T", " ");
  };

  // Flatten cards' parts lists into a individual records list
  const allReplacedParts: FlattenedPart[] = [];

  cards.forEach(card => {
    const cardPartsStr = card.parts || "";
    let parsedParts: PartItem[] = [];

    // Parse JSON parts list
    if (cardPartsStr.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(cardPartsStr);
        if (Array.isArray(parsed)) {
          parsedParts = parsed
            .filter((p: any) => (p.name || p.description || "").trim().length > 0 && (p.name || p.description || "").trim() !== "[]")
            .map((p, idx) => ({
              id: p.id || `part_${idx}_${card.id}`,
              name: p.name || p.description || "",
              date: p.date || card.date_out || card.date_in || "",
              target: p.target || "vehicle"
            }));
        }
      } catch (e) {
        // failed parsing
      }
    }

    // Fallback if parts is a simple string instead of JSON
    if (parsedParts.length === 0 && cardPartsStr.trim().length > 0 && cardPartsStr.trim() !== "[]") {
      parsedParts = [
        {
          id: `part_fallback_${card.id}`,
          name: cardPartsStr,
          date: card.date_out || card.date_in || "",
          target: "vehicle"
        }
      ];
    }

    parsedParts.forEach(part => {
      allReplacedParts.push({
        partId: part.id,
        partName: part.name,
        partDate: part.date.substring(0, 10),
        partTarget: part.target || "vehicle",
        cardId: card.id,
        vehicleId: card.vehicle_id || "",
        trailerId: card.trailer_id || "",
        driverName: card.driver_name || "",
        workTeam: card.work_team || "",
        workerName: card.worker_name || "",
        status: card.status
      });
    });
  });

  // Sort parts by date desc
  allReplacedParts.sort((a, b) => b.partDate.localeCompare(a.partDate) || b.cardId.localeCompare(a.cardId));

  // Filter parts list
  const filteredParts = allReplacedParts.filter(p => {
    const matchesSearch = 
      p.partName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.trailerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.cardId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.workerName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVehicle = !filterVehicle || 
      p.vehicleId.toLowerCase().includes(filterVehicle.toLowerCase()) ||
      p.trailerId.toLowerCase().includes(filterVehicle.toLowerCase());

    let matchesDate = true;
    if (filterStartDate && p.partDate < filterStartDate) matchesDate = false;
    if (filterEndDate && p.partDate > filterEndDate) matchesDate = false;

    return matchesSearch && matchesVehicle && matchesDate;
  });

  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, filterVehicle]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredParts.length / ITEMS_PER_PAGE) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * ITEMS_PER_PAGE;
  const paginatedParts = filteredParts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
          عرض <span className="text-slate-850 font-black">{Math.min(filteredParts.length, startIndex + 1)}</span> إلى{" "}
          <span className="text-slate-850 font-black">{Math.min(filteredParts.length, startIndex + ITEMS_PER_PAGE)}</span> من أصل{" "}
          <span className="text-indigo-650 font-black">{filteredParts.length}</span> قطعة غيار
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

  // Get unique vehicle and trailer IDs for filter dropdown
  const uniqueVehicles = Array.from(
    new Set(allReplacedParts.flatMap(p => [p.vehicleId, p.trailerId]).filter(Boolean))
  ).sort();

  const resetFilters = () => {
    setSearchQuery("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterVehicle("");
  };

  const handlePrintPartsList = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rowsHTML = filteredParts.map((p, idx) => {
      // إذا تم تغيير القطعة في المقطورة تظهر لوحة ترقيم المقطورة فقط
      const targetText = p.partTarget === "trailer"
        ? (p.trailerId ? `مقطورة: ${p.trailerId}` : "مقطورة (غير محددة)")
        : (p.vehicleId ? `شاحنة: ${p.vehicleId}` : (p.trailerId ? `مقطورة: ${p.trailerId}` : "—"));

      return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${p.partName}</strong></td>
        <td style="font-family: inherit;">${p.partDate || "—"}</td>
        <td>${targetText}</td>
        <td>${p.driverName || "—"}</td>
        <td>${p.workerName || p.workTeam || "—"}</td>
        <td style="font-weight: bold; color: #1e3a8a;">${p.cardId}</td>
      </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف قطع الغيار المستبدلة للأسطول</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; direction: rtl; color: #1e293b; }
          .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { font-size: 20px; margin: 0; color: #0d172a; }
          .header p { font-size: 11.5px; color: #64748b; margin: 5px 0 0 0; }
          .meta-info { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 15px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #94a3b8; padding: 8px 10px; font-size: 12px; text-align: right; }
          th { background-color: #f1f5f9; font-weight: bold; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 35px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>كشف وبيان قطع الغيار المستبدلة بالأسطول</h1>
          <p>مستخرج تلقائياً من نظام إدارة الصيانة وأرشيف بطاقات الورشة الرقمية</p>
        </div>
        <div class="meta-info">
          <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</span>
          <span>إجمالي القطع الواردة بالكشف: ${filteredParts.length} قطعة مستبدلة</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">#</th>
              <th style="width: 30%;">اسم / وصف قطعة الغيار المستبدلة</th>
              <th style="width: 15%;">تاريخ التبديل</th>
              <th style="width: 15%;">المركبة المستفيدة</th>
              <th style="width: 15%;">اسم السائق</th>
              <th style="width: 15%;">الفني المنفذ</th>
              <th style="width: 10%;">بطاقة الصيانة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
        <div class="footer">
          * تم توليد هذا الكشف عبر المنظومة الرقمية للورشة ويخضع للمراجعة والتدقيق المباشر من إدارة المخزن واللوازم المركزية.
        </div>
        <script>
          window.focus();
          window.print();
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportPartsCSV = () => {
    if (filteredParts.length === 0) return;
    const headers = [
      "#",
      "اسم وموصف قطعة الغيار المستبدلة",
      "الجهة",
      "تاريخ الاستبدال",
      "المركبة المستفيدة",
      "اسم السائق",
      "الفني المنفذ",
      "رقم بطاقة الورشة"
    ];

    const rows = filteredParts.map((p, idx) => {
      // في حالة المقطورة تظهر لوحة ترقيم المقطورة فقط
      const targetVehicle = p.partTarget === "trailer"
        ? (p.trailerId ? `مقطورة: ${p.trailerId}` : "مقطورة (غير محددة)")
        : (p.vehicleId ? `شاحنة: ${p.vehicleId}` : (p.trailerId ? `مقطورة: ${p.trailerId}` : "—"));

      return [
        idx + 1,
        `"${(p.partName || "").replace(/"/g, '""')}"`,
        `"${p.partTarget === "trailer" ? "المقطورة" : "المركبة"}"`,
        `"${p.partDate || "—"}"`,
        `"${targetVehicle}"`,
        `"${(p.driverName || "—").replace(/"/g, '""')}"`,
        `"${(p.workerName || p.workTeam || "—").replace(/"/g, '""')}"`,
        `"${p.cardId}"`
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `كشف_قطع_الغيار_المستبدلة_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="replaced-parts-section">
      {/* View Header Info */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span>قائمة وسجل قطع الغيار المستبدلة</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            سجل تحليلي كامل بكافة قطع الغيار والمواد المستبدلة والمستهلكة في الشاحنات والمقطورات.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print/Export Button */}
          <button
            onClick={handlePrintPartsList}
            disabled={filteredParts.length === 0}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black cursor-pointer transition ${
              filteredParts.length > 0
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
            title="طباعة وتصدير الكشف الفني بصيغة تقرير جاهز للطباعة والحفظ"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة وتصدير الكشف الفني ({filteredParts.length})</span>
          </button>

          {/* Export to Excel (CSV) */}
          <button
            onClick={handleExportPartsCSV}
            disabled={filteredParts.length === 0}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-black cursor-pointer transition ${
              filteredParts.length > 0
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
            title="تصدير بيانات الكشف الفني المفلترة كملف Excel (CSV)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Stats Bento Box for parts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div className="text-right">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">إجمالي القطع المستبدلة</span>
            <span className="text-xl font-extrabold text-slate-800 font-mono block mt-1">{allReplacedParts.length} قطعة</span>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div className="text-right">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">معدل التوريد بالكشف الفلتري</span>
            <span className="text-xl font-extrabold text-indigo-600 font-mono block mt-1">{filteredParts.length} قطعة</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div className="text-right">
            <span className="text-slate-400 text-[10px] font-bold uppercase block">الشاحنات المستهدفة بالتبديل</span>
            <span className="text-xl font-extrabold text-amber-600 font-mono block mt-1">{uniqueVehicles.length} شاحنة</span>
          </div>
          <div className="bg-amber-50 text-amber-600 p-2.5 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar widget */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          {/* Quick Find */}
          <div className="md:col-span-4 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم القطعة، الشاحنة، السائق، الفني..."
              className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-bold text-slate-800 text-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </div>

          {/* Veh selection filter */}
          <div className="md:col-span-3">
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-500 text-slate-800"
            >
              <option value="">جميع المركبات والشاحنات</option>
              {uniqueVehicles.map(vehId => (
                <option key={vehId} value={vehId}>{vehId}</option>
              ))}
            </select>
          </div>

          {/* Date range selection */}
          <div className="md:col-span-4 flex items-center gap-1.5">
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              title="تاريخ التصفية من"
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
            />
            <span className="text-slate-400 text-xs font-bold shrink-0">إلى</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              title="تاريخ التصفية إلى"
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
            />
          </div>

          {/* Reset button */}
          <div className="md:col-span-1 justify-self-center md:justify-self-end">
            <button
              onClick={resetFilters}
              disabled={!searchQuery && !filterStartDate && !filterEndDate && !filterVehicle}
              className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-center ${
                searchQuery || filterStartDate || filterEndDate || filterVehicle
                  ? "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"
                  : "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
              }`}
              title="إلغاء التصفية"
            >
              <Users className="w-4 h-4 scale-x-[-1]" />
            </button>
          </div>

        </div>
      </div>

      {/* Main Parts List table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {filteredParts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs font-semibold space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto animate-bounce" />
            <p>لا توجد أي قطع غيار مستبدلة تطابق محددات التصفية والبحث الحالية.</p>
            <p className="text-[10px] text-slate-400 font-medium">حاول البحث بمسافات أو بترميز قطع آخر.</p>
          </div>
        ) : (
          <>
            {renderPagination("top")}
            {/* Desktop Table View */}
            <div className={`overflow-x-auto ${isPhoneMode ? 'hidden' : 'hidden md:block'}`}>
              <table className="w-full text-right" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-black tracking-wider border-b border-slate-200 uppercase">
                    <th className="px-5 py-3.5 w-[5%] text-center">#</th>
                    <th className="px-5 py-3.5 w-[30%]">اسم وموصف قطعة الغيار المستبدلة</th>
                    <th className="px-5 py-3.5 w-[10%]">الجهة</th>
                    <th className="px-5 py-3.5 w-[12%]">تاريخ الاستبدال</th>
                    <th className="px-5 py-3.5 w-[13%]">المركبة المستفيدة</th>
                    <th className="px-5 py-3.5 w-[15%]">اسم السائق</th>
                    <th className="px-5 py-3.5 w-[15%]">صاحب العمل / الفني</th>
                    <th className="px-5 py-3.5 w-[10%] text-center">رقم بطاقة الورشة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-xs text-slate-700">
                  {paginatedParts.map((p, idx) => (
                    <tr key={`${p.partId}-${idx}`} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3 text-center text-slate-400 font-mono font-bold">{startIndex + idx + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                          <span className="text-slate-900 font-bold block">{p.partName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          p.partTarget === "trailer"
                            ? "bg-amber-50 text-amber-800 border border-amber-100"
                            : "bg-blue-50 text-blue-800 border border-blue-100"
                        }`}>
                          {p.partTarget === "trailer" ? "المقطورة" : "المركبة"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.partDate || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-0.5 text-slate-800">
                          {p.partTarget === "trailer" ? (
                            <button
                              type="button"
                              onClick={() => p.trailerId && setSelectedProfile({ type: "vehicle", name: p.trailerId })}
                              className="flex items-center gap-1.5 font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200/80 text-xs w-fit cursor-pointer transition text-right"
                              title="عرض البطاقة الفنية للمقطورة"
                            >
                              <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>مقطورة: {p.trailerId || "غير محددة"}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => p.vehicleId && setSelectedProfile({ type: "vehicle", name: p.vehicleId })}
                              className="flex items-center gap-1.5 font-bold text-slate-800 hover:text-blue-700 cursor-pointer transition font-mono text-right"
                              title="عرض البطاقة الفنية للمركبة"
                            >
                              <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{p.vehicleId ? `شاحنة: ${p.vehicleId}` : (p.trailerId ? `مقطورة: ${p.trailerId}` : "—")}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {p.driverName ? (
                           <button
                            type="button"
                            onClick={() => setSelectedProfile({ type: "driver", name: p.driverName })}
                            className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 font-medium cursor-pointer transition text-right"
                            title="عرض البطاقة الفنية للسائق وقائمة قطع الغيار المستبدلة أثناء سياقته"
                          >
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{p.driverName}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 font-medium">
                        {p.workerName ? (
                          <button
                            type="button"
                            onClick={() => setSelectedProfile({ type: "worker", name: p.workerName })}
                            className="text-slate-600 hover:text-indigo-600 hover:underline cursor-pointer transition font-semibold"
                            title="عرض البطاقة الفنية للفني وسجل أعماله"
                          >
                            {p.workerName}
                          </button>
                        ) : (
                          <span>{p.workTeam || "—"}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const foundCard = cards.find(c => c.id === p.cardId);
                            if (foundCard) {
                              setSelectedCard(foundCard);
                            } else if (onNavigateToCard) {
                              onNavigateToCard(p.cardId);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-100 text-indigo-700 font-mono font-black text-[11px] cursor-pointer shadow-2xs hover:shadow-sm active:scale-95 transition-all"
                          title="انقر لعرض بطاقة المركبة الفنية في نافذة منبثقة مباشرة"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{p.cardId}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch-Friendly Card List View */}
            <div className={`${isPhoneMode ? 'block' : 'block md:hidden'} p-3 space-y-2.5 bg-slate-50/50`}>
              {paginatedParts.map((p, idx) => (
                <div 
                  key={`mobile-${p.partId}-${idx}`}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                      #{startIndex + idx + 1}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      p.partTarget === "trailer"
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "bg-blue-50 text-blue-800 border border-blue-200"
                    }`}>
                      {p.partTarget === "trailer" ? "المقطورة" : "المركبة"}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{p.partName}</h4>
                    {p.partDate && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>تاريخ الاستبدال: {p.partDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">المركبة المستفيدة:</span>
                      {p.vehicleId || p.trailerId ? (
                        <button
                          type="button"
                          onClick={() => {
                            const name = p.vehicleId || p.trailerId;
                            if (name) setSelectedProfile({ type: "vehicle", name });
                          }}
                          className="font-bold text-blue-700 hover:underline cursor-pointer flex items-center gap-1 mt-0.5 truncate text-xs"
                        >
                          <Truck className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="truncate">{p.vehicleId ? `شاحنة ${p.vehicleId}` : `مقطورة ${p.trailerId}`}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">اسم السائق:</span>
                      {p.driverName ? (
                        <button
                          type="button"
                          onClick={() => setSelectedProfile({ type: "driver", name: p.driverName })}
                          className="font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1 mt-0.5 truncate text-xs"
                        >
                          <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{p.driverName}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>

                    {p.workerName && (
                      <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">الفني المسؤول:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedProfile({ type: "worker", name: p.workerName })}
                          className="font-bold text-indigo-700 hover:underline cursor-pointer"
                        >
                          {p.workerName}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const foundCard = cards.find(c => c.id === p.cardId);
                      if (foundCard) {
                        setSelectedCard(foundCard);
                      } else if (onNavigateToCard) {
                        onNavigateToCard(p.cardId);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold border border-indigo-200 transition cursor-pointer min-h-[40px]"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>عرض بطاقة الصيانة ({p.cardId})</span>
                  </button>
                </div>
              ))}
            </div>
            {renderPagination("bottom")}
          </>
        )}
      </div>

      {/* Hidden iframe for direct printing */}
      {printIframeUrl && (
        <iframe
          id="parts-print-iframe"
          src={printIframeUrl}
          className="hidden"
          title="Print Card Frame"
        />
      )}

      {/* Interactive Popup Modal Overlay for Vehicle Card Details */}
      {selectedCard && (
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fadeIn"
          style={{ direction: 'rtl' }}
          onClick={() => setSelectedCard(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col relative max-h-[92vh] overflow-hidden p-5 sm:p-6 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative gradient border */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-150 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">بطاقة صيانة مركبة</span>
                    {selectedCard.status === "check_in" && (
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        انتظار الفحص
                      </span>
                    )}
                    {selectedCard.status === "maintenance" && (
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
                        تحت صيانة الورشة
                      </span>
                    )}
                    {selectedCard.status === "completed" && (
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        جاهزة وخارجة
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-slate-900 font-mono mt-0.5">
                    بطاقة رقم # {selectedCard.id}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerPrintCard(selectedCard.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-lg border border-blue-100 text-xs font-bold transition cursor-pointer"
                  title="طباعة بطاقة الصيانة"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="إغلاق النافذة"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
              {/* Primary Technical Specifications Block */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider pb-1.5 border-b border-slate-200/60">
                  البيانات الأساسية للمركبة والسائق
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                      لوحة الشاحنة:
                    </span>
                    <span className="font-black text-slate-900 text-sm">{selectedCard.vehicle_id || "—"}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-amber-500 shrink-0" />
                      لوحة المقطورة:
                    </span>
                    {selectedCard.trailer_id ? (
                      <span className="font-extrabold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 text-xs">
                        {selectedCard.trailer_id}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-bold">بدون مقطورة</span>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-slate-400 shrink-0" />
                      اسم السائق:
                    </span>
                    <span className="font-bold text-slate-800">{selectedCard.driver_name || "—"}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      تاريخ الدخول:
                    </span>
                    <span className="font-bold text-slate-800 font-mono">{formatDateTime(selectedCard.date_in)}</span>
                  </div>
                </div>

                {selectedCard.date_out && (
                  <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100 flex items-center justify-between text-xs">
                    <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      تاريخ الخروج والتسليم النهائي:
                    </span>
                    <span className="font-bold text-emerald-900 font-mono">{formatDateTime(selectedCard.date_out)}</span>
                  </div>
                )}

                {selectedCard.damage_type && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">طبيعة العطب الشاكي:</span>
                    <p className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
                      {selectedCard.damage_type}
                    </p>
                  </div>
                )}
              </div>

              {/* Maintenance Work & Replaced Parts Block */}
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider pb-1.5 border-b border-slate-200/60">
                  تشخيص الورشة والقطع المستبدلة
                </span>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">تشخيص الفني الميكانيكي:</span>
                    <p className="bg-white p-3 rounded-lg border border-slate-200 text-slate-800 font-medium leading-relaxed">
                      {selectedCard.diagnosis || "لا يوجد تشخيص مسجل"}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">سجل القطع المستبدلة:</span>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      {(() => {
                        const partsText = selectedCard.parts || "";
                        if (!partsText.trim() || partsText.trim() === "[]") {
                          return <span className="text-slate-400 text-xs font-medium">لا توجد قطع غيار مسجلة</span>;
                        }
                        try {
                          if (partsText.trim().startsWith("[")) {
                            const parsed = JSON.parse(partsText);
                            if (Array.isArray(parsed)) {
                              const valid = parsed.filter((item: any) => (item.name || item.description || "").trim().length > 0 && (item.name || item.description || "").trim() !== "[]");
                              if (valid.length > 0) {
                                return (
                                  <ul className="space-y-2 divide-y divide-slate-100">
                                    {valid.map((item: any, idx: number) => (
                                      <li key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-extrabold text-slate-900">{item.name || item.description}</span>
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black ${
                                            item.target === "trailer"
                                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                                              : "bg-blue-100 text-blue-900 border border-blue-200"
                                          }`}>
                                            {item.target === "trailer" ? `مقطورة (${selectedCard.trailer_id || '—'})` : `شاحنة (${selectedCard.vehicle_id || '—'})`}
                                          </span>
                                        </div>
                                        {item.date && (
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            {item.date}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                );
                              }
                              return <span className="text-slate-400 text-xs font-medium">لا توجد قطع غيار مسجلة</span>;
                            }
                          }
                        } catch (e) {
                          // fallback
                        }
                        if (partsText.trim() === "[]") {
                          return <span className="text-slate-400 text-xs font-medium">لا توجد قطع غيار مسجلة</span>;
                        }
                        return <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{partsText}</p>;
                      })()}
                    </div>
                  </div>

                  {/* Mechanics & Teams */}
                  {(selectedCard.work_team || selectedCard.worker_name) && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {selectedCard.work_team && (
                        <div className="bg-indigo-50/70 border border-indigo-100 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-slate-500 font-semibold">الفرقة:</span>
                          <span className="font-bold text-indigo-900">{selectedCard.work_team}</span>
                        </div>
                      )}
                      {selectedCard.worker_name && (
                        <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-slate-500 font-semibold">الفني المسؤول:</span>
                          <span className="font-bold text-slate-800">{selectedCard.worker_name}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Repair Details */}
                  {selectedCard.repair_details && (() => {
                    let parsedRepairs: any[] = [];
                    try {
                      if (selectedCard.repair_details.trim().startsWith("[")) {
                        const p = JSON.parse(selectedCard.repair_details);
                        if (Array.isArray(p)) parsedRepairs = p;
                      }
                    } catch (e) {}

                    if (parsedRepairs.length > 0) {
                      return (
                        <div className="space-y-2 pt-2 border-t border-slate-200/60">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">تفاصيل أعمال الإصلاح:</span>
                          <div className="space-y-2">
                            {parsedRepairs.map((rep: any, idx: number) => (
                              <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                                <div className="font-bold text-slate-800 text-xs">
                                  <span className="text-blue-600">عطب #{idx + 1}:</span> {rep.description}
                                </div>
                                {rep.workers && rep.workers.length > 0 && (
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                                    <span>الفنيون:</span>
                                    <span className="text-slate-700">{rep.workers.join("، ")}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-150 pt-3 flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-400 font-medium">
                تم التسجيل بواسطة نظام بطاقة الصيانة الفنية
              </span>
              <button
                onClick={() => setSelectedCard(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Technical Profile Card Modal */}
      {selectedProfile && (
        <TechnicalCardModal
          type={selectedProfile.type}
          targetName={selectedProfile.name}
          cards={cards}
          driverPhones={driverPhones}
          workerPhones={workerPhones}
          onClose={() => setSelectedProfile(null)}
          onOpenProfile={(type, name) => setSelectedProfile({ type, name })}
          onOpenCard={(cardId) => {
            const found = cards.find(c => c.id === cardId);
            if (found) setSelectedCard(found);
            else if (onNavigateToCard) onNavigateToCard(cardId);
          }}
        />
      )}

    </div>
  );
}
