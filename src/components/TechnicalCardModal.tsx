/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from "react";
import { MaintenanceCard, PartItem } from "../types";
import { 
  X, 
  Printer, 
  Download, 
  Search, 
  Truck, 
  User, 
  Wrench, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  Layers, 
  Clock, 
  Hammer, 
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Phone,
  MessageCircle
} from "lucide-react";

export type ProfileType = "driver" | "worker" | "vehicle";

interface TechnicalCardModalProps {
  type: ProfileType;
  targetName: string;
  cards: MaintenanceCard[];
  driverPhones?: Record<string, string>;
  workerPhones?: Record<string, string>;
  onClose: () => void;
  onOpenProfile?: (type: ProfileType, name: string) => void;
  onOpenCard?: (cardId: string) => void;
}

interface FlattenedPart {
  id: string;
  name: string;
  date: string;
  target: "vehicle" | "trailer";
  cardId: string;
  vehicleId: string;
  trailerId?: string;
  driverName: string;
  workerName?: string;
  workTeam?: string;
  status: string;
}

interface FlattenedRepair {
  id: string;
  description: string;
  workers: string[];
  cardId: string;
  vehicleId: string;
  trailerId?: string;
  driverName: string;
  dateIn: string;
  dateOut?: string;
  workTeam?: string;
  status: string;
}

export default function TechnicalCardModal({
  type,
  targetName,
  cards = [],
  driverPhones = {},
  workerPhones = {},
  onClose,
  onOpenProfile,
  onOpenCard
}: TechnicalCardModalProps) {
  const [activeTab, setActiveTab] = useState<"parts" | "vehicles" | "repairs" | "cards">("parts");
  const [searchQuery, setSearchQuery] = useState("");
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  const cleanTarget = targetName.trim().toLowerCase();

  const targetPhone = type === "driver" 
    ? (driverPhones[targetName] || "")
    : type === "worker"
    ? (workerPhones[targetName] || "")
    : "";

  // Extract all parts from all cards
  const allParts = useMemo(() => {
    const list: FlattenedPart[] = [];
    cards.forEach(card => {
      const cardPartsStr = card.parts || "";
      let parsedParts: PartItem[] = [];

      if (cardPartsStr.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(cardPartsStr);
          if (Array.isArray(parsed)) {
            parsedParts = parsed
              .filter((p: any) => (p.name || p.description || "").trim().length > 0 && (p.name || p.description || "").trim() !== "[]")
              .map((p, idx) => ({
                id: p.id || `part_${card.id}_${idx}`,
                name: p.name || p.description || "",
                date: p.date || card.date_out || card.date_in || "",
                target: p.target || "vehicle"
              }));
          }
        } catch (e) {
          // ignore
        }
      }

      // If parts is plain text (multiline or single line)
      if (parsedParts.length === 0 && cardPartsStr.trim().length > 0 && cardPartsStr.trim() !== "[]") {
        const lines = cardPartsStr.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0 && l !== "[]");
        lines.forEach((line, idx) => {
          parsedParts.push({
            id: `part_text_${card.id}_${idx}`,
            name: line,
            date: card.date_out || card.date_in || "",
            target: "vehicle"
          });
        });
      }

      parsedParts.forEach(part => {
        list.push({
          id: part.id,
          name: part.name,
          date: part.date.substring(0, 10),
          target: part.target || "vehicle",
          cardId: card.id,
          vehicleId: card.vehicle_id || "",
          trailerId: card.trailer_id || "",
          driverName: card.driver_name || "",
          workerName: card.worker_name || "",
          workTeam: card.work_team || "",
          status: card.status
        });
      });
    });
    return list;
  }, [cards]);

  // Extract all repair tasks from cards
  const allRepairs = useMemo(() => {
    const list: FlattenedRepair[] = [];
    cards.forEach(card => {
      const details = card.repair_details || "";
      let parsedRepairs: { id: string; description: string; workers: string[] }[] = [];

      if (details.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(details);
          if (Array.isArray(parsed)) {
            parsedRepairs = parsed
              .filter((r: any) => (r.description || r.action || "").trim().length > 0 && (r.description || r.action || "").trim() !== "[]")
              .map((r, idx) => ({
                id: r.id || `rep_${card.id}_${idx}`,
                description: r.description || r.action || "",
                workers: Array.isArray(r.workers) ? r.workers : (r.worker_name ? [r.worker_name] : (r.worker ? [r.worker] : []))
              }));
          }
        } catch (e) {
          // ignore
        }
      }

      if (parsedRepairs.length === 0 && details.trim().length > 0 && details.trim() !== "[]") {
        const lines = details.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0 && l !== "[]");
        const defaultWorkers = card.worker_name ? card.worker_name.split(/[،,\n\r]+/).map(w => w.trim()).filter(Boolean) : [];
        lines.forEach((line, idx) => {
          parsedRepairs.push({
            id: `rep_text_${card.id}_${idx}`,
            description: line,
            workers: defaultWorkers
          });
        });
      }

      parsedRepairs.forEach(rep => {
        list.push({
          id: rep.id,
          description: rep.description,
          workers: rep.workers,
          cardId: card.id,
          vehicleId: card.vehicle_id || "",
          trailerId: card.trailer_id || "",
          driverName: card.driver_name || "",
          dateIn: card.date_in || "",
          dateOut: card.date_out || "",
          workTeam: card.work_team || "",
          status: card.status
        });
      });
    });
    return list;
  }, [cards]);

  // Filter items specifically for the active profile type
  const targetCards = useMemo(() => {
    if (type === "driver") {
      return cards.filter(c => c.driver_name && c.driver_name.trim().toLowerCase() === cleanTarget);
    } else if (type === "vehicle") {
      return cards.filter(c => c.vehicle_id && c.vehicle_id.trim().toLowerCase() === cleanTarget);
    } else {
      // worker
      return cards.filter(c => {
        const matchesWorkerField = c.worker_name && c.worker_name.toLowerCase().includes(cleanTarget);
        const cardRepairs = allRepairs.filter(r => r.cardId === c.id);
        const matchesRepairWorkers = cardRepairs.some(r => r.workers.some(w => w.trim().toLowerCase() === cleanTarget));
        return matchesWorkerField || matchesRepairWorkers;
      });
    }
  }, [cards, type, cleanTarget, allRepairs]);

  // Target parts
  const targetParts = useMemo(() => {
    if (type === "driver") {
      // Replaced parts while this driver was driving!
      return allParts.filter(p => p.driverName && p.driverName.trim().toLowerCase() === cleanTarget);
    } else if (type === "vehicle") {
      // Replaced parts on this vehicle (or attached trailer)
      return allParts.filter(p => p.vehicleId && p.vehicleId.trim().toLowerCase() === cleanTarget);
    } else {
      // Parts on cards where this worker intervened
      const cardIds = new Set(targetCards.map(c => c.id));
      return allParts.filter(p => cardIds.has(p.cardId));
    }
  }, [allParts, type, cleanTarget, targetCards]);

  // Target repairs
  const targetRepairs = useMemo(() => {
    if (type === "worker") {
      return allRepairs.filter(r => 
        r.workers.some(w => w.trim().toLowerCase() === cleanTarget) ||
        (r.workers.length === 0 && targetCards.some(c => c.id === r.cardId))
      );
    } else if (type === "vehicle") {
      return allRepairs.filter(r => r.vehicleId && r.vehicleId.trim().toLowerCase() === cleanTarget);
    } else {
      return allRepairs.filter(r => r.driverName && r.driverName.trim().toLowerCase() === cleanTarget);
    }
  }, [allRepairs, type, cleanTarget, targetCards]);

  // Associated distinct vehicles / drivers / workers
  const associatedVehicles = useMemo(() => {
    const map = new Map<string, {
      vehicleId: string;
      trailers: Set<string>;
      count: number;
      firstDate: string;
      lastDate: string;
      partsCount: number;
    }>();

    targetCards.forEach(card => {
      const v = card.vehicle_id?.trim() || "غير محدد";
      const existing = map.get(v) || {
        vehicleId: v,
        trailers: new Set<string>(),
        count: 0,
        firstDate: card.date_in || "",
        lastDate: card.date_in || "",
        partsCount: 0
      };

      existing.count += 1;
      if (card.trailer_id?.trim()) existing.trailers.add(card.trailer_id.trim());
      if (card.date_in) {
        if (!existing.firstDate || card.date_in < existing.firstDate) existing.firstDate = card.date_in;
        if (!existing.lastDate || card.date_in > existing.lastDate) existing.lastDate = card.date_in;
      }
      map.set(v, existing);
    });

    targetParts.forEach(p => {
      const v = p.vehicleId?.trim() || "غير محدد";
      if (map.has(v)) {
        map.get(v)!.partsCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [targetCards, targetParts]);

  const associatedDrivers = useMemo(() => {
    const map = new Map<string, { driver: string; count: number; lastDate: string }>();
    targetCards.forEach(c => {
      const d = c.driver_name?.trim() || "غير محدد";
      const item = map.get(d) || { driver: d, count: 0, lastDate: c.date_in || "" };
      item.count += 1;
      if (c.date_in && c.date_in > item.lastDate) item.lastDate = c.date_in;
      map.set(d, item);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [targetCards]);

  // Search filtering
  const filteredParts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return targetParts;
    return targetParts.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.vehicleId.toLowerCase().includes(q) ||
      (p.trailerId && p.trailerId.toLowerCase().includes(q)) ||
      p.cardId.toLowerCase().includes(q) ||
      (p.workerName && p.workerName.toLowerCase().includes(q))
    );
  }, [targetParts, searchQuery]);

  const filteredRepairs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return targetRepairs;
    return targetRepairs.filter(r => 
      r.description.toLowerCase().includes(q) ||
      r.vehicleId.toLowerCase().includes(q) ||
      r.cardId.toLowerCase().includes(q) ||
      r.workers.some(w => w.toLowerCase().includes(q))
    );
  }, [targetRepairs, searchQuery]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return targetCards;
    return targetCards.filter(c => 
      c.id.toLowerCase().includes(q) ||
      (c.vehicle_id && c.vehicle_id.toLowerCase().includes(q)) ||
      (c.driver_name && c.driver_name.toLowerCase().includes(q)) ||
      (c.trailer_id && c.trailer_id.toLowerCase().includes(q)) ||
      (c.damage_type && c.damage_type.toLowerCase().includes(q))
    );
  }, [targetCards, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    if (activeTab === "parts") {
      csvContent += "الرقم التسلسلي,اسم القطعة,الجهة,رقم المركبة,رقم المقطورة,السائق,الفني المسجل,تاريخ الاستبدال,رقم البطاقة\n";
      targetParts.forEach((p, idx) => {
        csvContent += `"${idx + 1}","${p.name.replace(/"/g, '""')}","${p.target === 'trailer' ? 'مقطورة' : 'مركبة'}","${p.vehicleId}","${p.trailerId || ''}","${p.driverName}","${p.workerName || ''}","${p.date}","${p.cardId}"\n`;
      });
    } else if (activeTab === "repairs") {
      csvContent += "الرقم,وصف الإصلاح,المركبة,المقطورة,الفنيون,تاريخ الدخول,رقم البطاقة,الحالة\n";
      targetRepairs.forEach((r, idx) => {
        csvContent += `"${idx + 1}","${r.description.replace(/"/g, '""')}","${r.vehicleId}","${r.trailerId || ''}","${r.workers.join(' - ')}","${r.dateIn}","${r.cardId}","${r.status}"\n`;
      });
    } else {
      csvContent += "رقم البطاقة,المركبة,المقطورة,السائق,تاريخ الدخول,تاريخ الخروج,الحالة,طبيعة العطب\n";
      targetCards.forEach(c => {
        csvContent += `"${c.id}","${c.vehicle_id || ''}","${c.trailer_id || ''}","${c.driver_name || ''}","${c.date_in}","${c.date_out || ''}","${c.status}","${(c.damage_type || '').replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `بطاقة_فنية_${type}_${targetName.replace(/\s+/g, '_')}_${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print technical profile
  const handlePrint = () => {
    const iframe = printIframeRef.current;
    if (!iframe) return;

    const profileTitle = 
      type === "driver" ? `البطاقة الفنية للسائق: ${targetName}` :
      type === "worker" ? `البطاقة الفنية للفني / العامل: ${targetName}` :
      `البطاقة الفنية للمركبة: ${targetName}`;

    const partsRows = targetParts.map((p, i) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${p.name}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${p.target === 'trailer' ? 'مقطورة' : 'مركبة'}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;direction:ltr;">${p.vehicleId || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${p.trailerId || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;">${p.driverName || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${p.date || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-family:monospace;">${p.cardId}</td>
      </tr>
    `).join("");

    const vehiclesRows = associatedVehicles.map((v, i) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${i + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;direction:ltr;text-align:center;">${v.vehicleId}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${Array.from(v.trailers).join('، ') || 'بدون'}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${v.count}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${v.partsCount}</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;">${v.lastDate ? v.lastDate.split('T')[0] : '—'}</td>
      </tr>
    `).join("");

    const printHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${profileTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 20px; color: #1e293b; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 18px; font-weight: 800; color: #0f172a; }
          .stats { display: flex; gap: 15px; margin-bottom: 20px; }
          .stat-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc; flex: 1; }
          .stat-box .num { font-size: 18px; font-weight: bold; color: #2563eb; }
          .stat-box .lbl { font-size: 11px; color: #64748b; }
          h3 { font-size: 14px; margin-top: 20px; margin-bottom: 8px; color: #1e293b; border-right: 4px solid #2563eb; padding-right: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; text-align: center; }
          @media print {
            body { margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${profileTitle}</div>
            ${targetPhone ? `<div style="font-size: 13px; color: #047857; font-weight: bold; margin-top: 4px; direction: ltr; text-align: right;">📞 هاتف التواصل: ${targetPhone}</div>` : ''}
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">نظام إدارة الورشة الفنية الموحد • تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</div>
          </div>
          <div style="text-align: left; font-size: 12px; font-weight: bold; color: #2563eb;">سجل تاريخي رسمي</div>
        </div>

        <div class="stats">
          <div class="stat-box">
            <div class="lbl">إجمالي بطاقات الصيانة</div>
            <div class="num">${targetCards.length}</div>
          </div>
          <div class="stat-box">
            <div class="lbl">إجمالي القطع المستبدلة</div>
            <div class="num">${targetParts.length}</div>
          </div>
          <div class="stat-box">
            <div class="lbl">${type === 'vehicle' ? 'عدد السائقين' : 'المركبات المرتبطة'}</div>
            <div class="num">${type === 'vehicle' ? associatedDrivers.length : associatedVehicles.length}</div>
          </div>
          <div class="stat-box">
            <div class="lbl">آخر نشاط مسجل</div>
            <div class="num" style="font-size:13px;">${targetCards[0]?.date_in ? targetCards[0].date_in.split('T')[0] : '—'}</div>
          </div>
        </div>

        <h3>سجل قطع الغيار المستبدلة (${targetParts.length} قطعة)</h3>
        <table>
          <thead>
            <tr>
              <th style="width:40px;">#</th>
              <th>اسم قطعة الغيار</th>
              <th style="width:70px;">الجهة</th>
              <th>المركبة المستفيدة</th>
              <th>المقطورة</th>
              <th>السائق</th>
              <th>تاريخ الاستبدال</th>
              <th>رقم البطاقة</th>
            </tr>
          </thead>
          <tbody>
            ${partsRows || '<tr><td colspan="8" style="text-align:center;padding:12px;">لا توجد قطع غيار مسجلة</td></tr>'}
          </tbody>
        </table>

        ${associatedVehicles.length > 0 && type !== 'vehicle' ? `
          <h3>سجل المركبات والمقطورات المرتبطة (${associatedVehicles.length} مركبة)</h3>
          <table>
            <thead>
              <tr>
                <th style="width:40px;">#</th>
                <th>رقم المركبة / الشاحنة</th>
                <th>المقطورات المقترنة</th>
                <th>مرات التسجيل</th>
                <th>القطع المستبدلة بها</th>
                <th>آخر تاريخ دخول</th>
              </tr>
            </thead>
            <tbody>
              ${vehiclesRows}
            </tbody>
          </table>
        ` : ''}

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
          <div>مسؤول الورشة الفني: __________________</div>
          <div>التوقيع والختم: __________________</div>
        </div>
      </body>
      </html>
    `;

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 350);
    }
  };

  const getProfileMeta = () => {
    switch (type) {
      case "driver":
        return {
          icon: User,
          badge: "بطاقة فنية لسائق معتمد",
          color: "emerald",
          headerBg: "bg-emerald-500",
          lightBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          stats: [
            { label: "إجمالي مرات الدخول للورشة", val: targetCards.length, icon: Calendar },
            { label: "قطع الغيار المستبدلة أثناء سياقته", val: targetParts.length, icon: Layers },
            { label: "المركبات المختلفة التي قادها", val: associatedVehicles.length, icon: Truck },
            { label: "آخر تاريخ دخول مسجل", val: targetCards[0]?.date_in ? targetCards[0].date_in.split("T")[0] : "—", icon: Clock }
          ]
        };
      case "worker":
        return {
          icon: Wrench,
          badge: "بطاقة فنية لفني / عامل صيانة",
          color: "indigo",
          headerBg: "bg-indigo-600",
          lightBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
          stats: [
            { label: "إجمالي المهام والإصلاحات", val: targetRepairs.length, icon: Hammer },
            { label: "بطاقات الصيانة المشارك بها", val: targetCards.length, icon: FileText },
            { label: "المركبات التي باشر صيانتها", val: associatedVehicles.length, icon: Truck },
            { label: "قطع الغيار المرتبطة بمهامه", val: targetParts.length, icon: Layers }
          ]
        };
      case "vehicle":
      default:
        return {
          icon: Truck,
          badge: "بطاقة فنية لمركبة / شاحنة أسطول",
          color: "blue",
          headerBg: "bg-blue-600",
          lightBg: "bg-blue-50 text-blue-700 border-blue-200",
          stats: [
            { label: "إجمالي مرات الدخول للورشة", val: targetCards.length, icon: Calendar },
            { label: "إجمالي قطع الغيار المستبدلة", val: targetParts.length, icon: Layers },
            { label: "السائقون الذين قادوها", val: associatedDrivers.length, icon: User },
            { label: "الحالة الحالية للمركبة", val: targetCards[0]?.status === "completed" ? "مسلمة وجاهزة" : targetCards[0]?.status === "maintenance" ? "قيد الصيانة" : "بانتظار الفحص", icon: ShieldCheck }
          ]
        };
    }
  };

  const meta = getProfileMeta();
  const IconComp = meta.icon;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-fadeIn"
      style={{ direction: "rtl" }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl flex flex-col relative max-h-[92vh] overflow-hidden text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Header Accent */}
        <div className={`h-2 ${meta.headerBg} w-full`}></div>

        {/* Modal Top Bar */}
        <div className="p-3.5 sm:p-5 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-start justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 sm:p-3 rounded-2xl ${meta.lightBg} border shadow-2xs shrink-0`}>
                <IconComp className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {meta.badge}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    {targetCards.length} بطاقة مسجلة
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 flex items-center gap-2">
                  <span>{targetName}</span>
                  {type === "vehicle" && (
                    <span className="text-xs font-mono font-normal text-slate-400">لوحة ترقيم</span>
                  )}
                </h2>
                {targetPhone && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <a
                      href={`tel:${targetPhone}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 shadow-2xs transition"
                      dir="ltr"
                      title="اتصال هاتفي مباشر"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{targetPhone}</span>
                    </a>
                    <a
                      href={`https://wa.me/${targetPhone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-bold border border-green-200 transition"
                      title="مراسلة عبر واتساب"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-[11px]">واتساب</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer min-h-[38px]"
              title="طباعة البطاقة الفنية"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>طباعة البطاقة</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-emerald-400 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer min-h-[38px]"
              title="تصدير إلى ملف إكسل"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>تصدير CSV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bento Quick Stats Grid */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-150">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {meta.stats.map((s, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-bold">{s.label}</span>
                  <s.icon className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-lg font-black text-slate-800 font-mono">
                  {s.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Selection Bar & Search Input */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/50 border-b border-slate-150 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {/* Tab: Parts */}
            <button
              type="button"
              onClick={() => setActiveTab("parts")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === "parts"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>قطع الغيار المستبدلة</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'parts' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {targetParts.length}
              </span>
            </button>

            {/* Tab: Vehicles (for driver/worker) or Drivers (for vehicle) */}
            {type !== "vehicle" ? (
              <button
                type="button"
                onClick={() => setActiveTab("vehicles")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === "vehicles"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>المركبات التي عمل عليها</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'vehicles' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {associatedVehicles.length}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab("vehicles")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === "vehicles"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>السائقون الذين قادوها</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'vehicles' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {associatedDrivers.length}
                </span>
              </button>
            )}

            {/* Tab: Repairs (especially for workers) */}
            {type === "worker" && (
              <button
                type="button"
                onClick={() => setActiveTab("repairs")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  activeTab === "repairs"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>سجل الإصلاحات والمهام</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'repairs' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {targetRepairs.length}
                </span>
              </button>
            )}

            {/* Tab: Check-in / Out Cards */}
            <button
              type="button"
              onClick={() => setActiveTab("cards")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeTab === "cards"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>سجل بطاقات الدخول والخروج</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'cards' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {targetCards.length}
              </span>
            </button>
          </div>

          {/* Quick Search inside modal */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في هذه البطاقة..."
              className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Display Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-white">
          {/* 1. REPLACED PARTS TAB */}
          {activeTab === "parts" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                <span>
                  {type === "driver" 
                    ? `قائمة قطع الغيار المستبدلة أثناء سياقة (${targetName}) وتحديد المركبة المستفيدة:`
                    : type === "worker"
                    ? `قائمة قطع الغيار المرتبطة بالبطاقات والمهام الفنية التي عمل عليها (${targetName}):`
                    : `سجل قطع الغيار المستبدلة في المركبة والمقطورة (${targetName}):`}
                </span>
                <span className="text-[11px] text-slate-400 font-normal">{filteredParts.length} قطعة</span>
              </div>

              {filteredParts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
                  <Layers className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-600">لا توجد قطع غيار مسجلة تطابق البحث</p>
                  <p className="text-[10px] text-slate-400">لم يتم تسجيل أي قطع غيار مستبدلة ضمن هذا السجل حتى الآن.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">#</th>
                        <th className="py-2.5 px-3">اسم قطعة الغيار</th>
                        <th className="py-2.5 px-3 text-center">الجهة</th>
                        <th className="py-2.5 px-3">المركبة المستفيدة</th>
                        <th className="py-2.5 px-3">المقطورة</th>
                        {type !== "driver" && <th className="py-2.5 px-3">السائق</th>}
                        {type !== "worker" && <th className="py-2.5 px-3">الفني المسؤول</th>}
                        <th className="py-2.5 px-3 text-center">تاريخ الاستبدال</th>
                        <th className="py-2.5 px-3 text-center">بطاقة الصيانة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredParts.map((part, idx) => (
                        <tr key={part.id} className="hover:bg-slate-50/80 transition group">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {part.name}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {part.target === "trailer" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                مقطورة
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                شاحنة
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {part.vehicleId ? (
                              <button
                                type="button"
                                onClick={() => onOpenProfile && onOpenProfile("vehicle", part.vehicleId)}
                                className="font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1 font-mono"
                                title="عرض البطاقة الفنية للمركبة"
                              >
                                <Truck className="w-3 h-3 text-blue-500" />
                                <span>{part.vehicleId}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {part.trailerId || "—"}
                          </td>
                          {type !== "driver" && (
                            <td className="py-2.5 px-3">
                              {part.driverName ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenProfile && onOpenProfile("driver", part.driverName)}
                                  className="font-medium text-slate-700 hover:text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
                                  title="عرض البطاقة الفنية للسائق"
                                >
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{part.driverName}</span>
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          )}
                          {type !== "worker" && (
                            <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                              {part.workerName || part.workTeam || "—"}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-center text-slate-500 text-[11px] whitespace-nowrap">
                            {part.date || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => onOpenCard && onOpenCard(part.cardId)}
                              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-mono text-[10.5px] font-bold border border-indigo-100 transition cursor-pointer"
                              title="عرض تفاصيل بطاقة الورشة"
                            >
                              {part.cardId}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 2. VEHICLES / DRIVERS TAB */}
          {activeTab === "vehicles" && (
            <div className="space-y-3">
              {type !== "vehicle" ? (
                <>
                  <div className="text-xs text-slate-500 font-bold px-1">
                    سجل المركبات والشاحنات التي عمل عليها {type === "driver" ? `السائق (${targetName})` : `الفني (${targetName})`}:
                  </div>
                  {associatedVehicles.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                      لا توجد مركبات مسجلة في التاريخ.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {associatedVehicles.map((v) => (
                        <div 
                          key={v.vehicleId} 
                          className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => onOpenProfile && onOpenProfile("vehicle", v.vehicleId)}
                              className="flex items-center gap-1.5 font-black text-blue-700 hover:text-blue-900 text-sm cursor-pointer"
                              title="فتح البطاقة الفنية لهذه المركبة"
                            >
                              <Truck className="w-4 h-4 text-blue-600" />
                              <span>{v.vehicleId}</span>
                            </button>
                            <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                              {v.count} رحلات/دخول
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 space-y-1 pt-1 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <span>المقطورات المقترنة:</span>
                              <strong className="text-slate-800">{Array.from(v.trailers).join("، ") || "بدون"}</strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>القطع المستبدلة:</span>
                              <strong className="text-slate-800">{v.partsCount} قطع</strong>
                            </div>
                            {v.lastDate && (
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>آخر دخول:</span>
                                <span>{v.lastDate.split("T")[0]}</span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onOpenProfile && onOpenProfile("vehicle", v.vehicleId)}
                            className="w-full mt-2 py-1 text-center bg-slate-50 hover:bg-blue-50 text-blue-600 text-xs font-bold rounded-lg border border-slate-200/80 transition cursor-pointer flex items-center justify-center gap-1"
                          >
                            <span>فتح بطاقة المركبة</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-xs text-slate-500 font-bold px-1">
                    قائمة السائقين الذين قاموا بقيادة وتسجيل دخول المركبة ({targetName}):
                  </div>
                  {associatedDrivers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                      لا يوجد سائقون مسجلون لهذه المركبة.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {associatedDrivers.map((d) => (
                        <div 
                          key={d.driver} 
                          className="bg-white border border-slate-200 hover:border-emerald-400 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => onOpenProfile && onOpenProfile("driver", d.driver)}
                              className="flex items-center gap-1.5 font-bold text-slate-800 hover:text-emerald-700 text-sm cursor-pointer"
                              title="فتح البطاقة الفنية لهذا السائق"
                            >
                              <User className="w-4 h-4 text-emerald-600" />
                              <span>{d.driver}</span>
                            </button>
                            <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                              {d.count} مرات دخول
                            </span>
                          </div>

                          {d.lastDate && (
                            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                              <span>آخر دخول مسجل:</span>
                              <span>{d.lastDate.split("T")[0]}</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenProfile && onOpenProfile("driver", d.driver)}
                            className="w-full mt-2 py-1 text-center bg-slate-50 hover:bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-slate-200/80 transition cursor-pointer flex items-center justify-center gap-1"
                          >
                            <span>فتح بطاقة السائق</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 3. REPAIRS TAB (FOR WORKERS) */}
          {activeTab === "repairs" && type === "worker" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                <span>سجل المهام والأعمال الفنية والإصلاحات المنجزة بواسطة ({targetName}):</span>
                <span className="text-[11px] text-slate-400 font-normal">{filteredRepairs.length} عمل</span>
              </div>

              {filteredRepairs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                  لا توجد مهام صيانة مسجلة تطابق البحث.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">#</th>
                        <th className="py-2.5 px-3">وصف الإصلاح / العمل الفني</th>
                        <th className="py-2.5 px-3">المركبة</th>
                        <th className="py-2.5 px-3">المقطورة</th>
                        <th className="py-2.5 px-3">الفنيون المشاركون</th>
                        <th className="py-2.5 px-3 text-center">تاريخ الدخول</th>
                        <th className="py-2.5 px-3 text-center">بطاقة الصيانة</th>
                        <th className="py-2.5 px-3 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRepairs.map((rep, idx) => (
                        <tr key={rep.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {rep.description}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                            {rep.vehicleId || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {rep.trailerId || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            {rep.workers && rep.workers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {rep.workers.map(w => (
                                  <span key={w} className={`px-1.5 py-0.5 rounded text-[10px] ${w.trim().toLowerCase() === cleanTarget ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-100 text-slate-600'}`}>
                                    {w}
                                  </span>
                                ))}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                            {rep.dateIn ? rep.dateIn.split("T")[0] : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => onOpenCard && onOpenCard(rep.cardId)}
                              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-mono text-[10.5px] font-bold border border-indigo-100 transition cursor-pointer"
                            >
                              {rep.cardId}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rep.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              rep.status === 'maintenance' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {rep.status === 'completed' ? 'مسلمة' : rep.status === 'maintenance' ? 'قيد الصيانة' : 'بانتظار الفحص'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 4. CARDS TAB (CHECK-IN / OUT HISTORY) */}
          {activeTab === "cards" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                <span>سجل بطاقات الصيانة وعمليات الدخول والخروج المسجلة:</span>
                <span className="text-[11px] text-slate-400 font-normal">{filteredCards.length} بطاقة</span>
              </div>

              {filteredCards.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                  لا توجد بطاقات صيانة مطابقة للبحث.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 text-center">رقم البطاقة</th>
                        <th className="py-2.5 px-3">المركبة</th>
                        <th className="py-2.5 px-3">المقطورة</th>
                        <th className="py-2.5 px-3">السائق الدولي</th>
                        <th className="py-2.5 px-3 text-center">تاريخ الدخول</th>
                        <th className="py-2.5 px-3 text-center">تاريخ الخروج</th>
                        <th className="py-2.5 px-3">شكوى العطب / التشخيص</th>
                        <th className="py-2.5 px-3 text-center">الحالة</th>
                        <th className="py-2.5 px-3 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCards.map((card) => (
                        <tr key={card.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700">
                            {card.id}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {card.vehicle_id || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {card.trailer_id || "—"}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">
                            {card.driver_name || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                            {card.date_in ? card.date_in.split("T")[0] : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                            {card.date_out ? card.date_out.split("T")[0] : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate text-[11px]">
                            {card.damage_type || card.diagnosis || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              card.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              card.status === 'maintenance' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {card.status === 'completed' ? 'مسلمة' : card.status === 'maintenance' ? 'قيد الصيانة' : 'بانتظار الفحص'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => onOpenCard && onOpenCard(card.id)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-bold transition cursor-pointer"
                            >
                              عرض
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>نظام بطاقات الورشة الفنية الشاملة المعتمدة</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition cursor-pointer text-xs"
          >
            إغلاق
          </button>
        </div>

        {/* Hidden print iframe */}
        <iframe ref={printIframeRef} className="hidden" title="Technical Card Print Frame" />
      </div>
    </div>
  );
}
