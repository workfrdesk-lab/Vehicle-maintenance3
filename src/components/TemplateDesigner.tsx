/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Layout, Save, Info, CheckCircle2, RefreshCw, Eye, EyeOff, ShieldAlert, Trash2 } from "lucide-react";

interface TemplateDesignerProps {
  initialTemplate: string;
  initialDailyTemplate: string;
  initialMonthlyTemplate: string;
  onSave: (key: string, newTemplate: string) => Promise<boolean>;
  cards: any[];
  onFormatDatabase?: () => Promise<void>;
  isPhoneMode?: boolean;
}

export default function TemplateDesigner({
  initialTemplate,
  initialDailyTemplate,
  initialMonthlyTemplate,
  onSave,
  cards,
  onFormatDatabase,
  isPhoneMode = false
}: TemplateDesignerProps) {
  const [htmlTemplate, setHtmlTemplate] = useState(initialTemplate);
  const [dailyTemplate, setDailyTemplate] = useState(initialDailyTemplate);
  const [monthlyTemplate, setMonthlyTemplate] = useState(initialMonthlyTemplate);

  const [activeKey, setActiveKey] = useState<'html_template' | 'daily_report_template' | 'monthly_report_template'>('html_template');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  // Database Format States
  const [formatCode, setFormatCode] = useState("");
  const [formatLoading, setFormatLoading] = useState(false);
  const [formatSuccess, setFormatSuccess] = useState(false);
  const [formatError, setFormatError] = useState("");

  const handleFormatDatabase = async (codeToVerify: string) => {
    if (codeToVerify !== "0659155323") {
      setFormatError("رمز التفعيل غير صحيح، يرجى إدخال الرقم الصحيح لإجراء عملية الفرمتة.");
      return;
    }
    setFormatLoading(true);
    setFormatSuccess(false);
    setFormatError("");
    try {
      const response = await fetch("/api/database/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToVerify })
      });
      const data = await response.json();
      if (response.ok) {
        setFormatSuccess(true);
        setFormatCode("");
        if (onFormatDatabase) {
          await onFormatDatabase();
        }
        setTimeout(() => setFormatSuccess(false), 5000);
      } else {
        setFormatError(data.error || "فشلت عملية تهيئة البيانات");
      }
    } catch (err) {
      setFormatError("حدث خطأ في الشبكة أثناء محاولة تهيئة قاعدة البيانات");
    } finally {
      setFormatLoading(false);
    }
  };

  const isDirtyRef = React.useRef({ html: false, daily: false, monthly: false });

  // Sync state if initial templates are loaded asynchronously and user has not modified them
  useEffect(() => {
    if (!isDirtyRef.current.html) {
      setHtmlTemplate(initialTemplate);
    }
  }, [initialTemplate]);

  useEffect(() => {
    if (!isDirtyRef.current.daily) {
      setDailyTemplate(initialDailyTemplate);
    }
  }, [initialDailyTemplate]);

  useEffect(() => {
    if (!isDirtyRef.current.monthly) {
      setMonthlyTemplate(initialMonthlyTemplate);
    }
  }, [initialMonthlyTemplate]);

  // Safe Parsers for Preview rendering
  const parseRepairsHTML = (repairsStr?: string): string => {
    if (!repairsStr || repairsStr.trim() === "[]" || repairsStr.trim() === "") return "—";
    const trimmed = repairsStr.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return "—";
          const valid = parsed.filter((item: any) => (item.description || item.action || "").trim().length > 0 && (item.description || item.action || "").trim() !== "[]");
          if (valid.length === 0) return "—";
          return `<ul style="margin: 0; padding-right: 15px; text-align: right; direction: rtl; line-height: 1.4;">` +
            valid.map((item: any) => `<li style="margin-bottom: 5px;"><strong>${item.description || "—"}</strong></li>`).join("") +
            `</ul>`;
        }
      } catch (e) {
        // ignore
      }
    }
    return repairsStr.replace(/\n/g, "<br/>");
  };

  const parsePartsHTML = (partsStr?: string): string => {
    if (!partsStr || partsStr.trim() === "[]" || partsStr.trim() === "") return "—";
    const trimmed = partsStr.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return "—";
          const valid = parsed.filter((item: any) => (item.name || item.description || "").trim().length > 0 && (item.name || item.description || "").trim() !== "[]");
          if (valid.length === 0) return "—";
          return `<ul style="margin: 0; padding-right: 15px; text-align: right; direction: rtl; line-height: 1.4;">` +
            valid.map((item: any) => {
              const name = item.name || item.description || "—";
              const targetLabel = item.target === "trailer" ? "المقطورة" : "المركبة";
              const targetColor = item.target === "trailer" ? "#b45309" : "#1d4ed8";
              const targetBg = item.target === "trailer" ? "#fef3c7" : "#dbeafe";
              const targetBadge = ` <span style="font-size: 9px; padding: 1px 4px; background: ${targetBg}; color: ${targetColor}; border-radius: 3px; font-weight: bold; margin-right: 4px;">${targetLabel}</span>`;
              const dateStr = item.date ? ` <span style="font-size: 10px; color: #475569;">(تاريخ: ${item.date})</span>` : "";
              return `<li style="margin-bottom: 5px;"><strong>${name}</strong>${targetBadge}${dateStr}</li>`;
            }).join("") +
            `</ul>`;
        }
      } catch (e) {
        // ignore
      }
    }
    return partsStr.replace(/\n/g, "<br/>");
  };

  // Card Preview Real/Sample HTML
  const getCardMockHtml = (tpl: string) => {
    let previewHtml = tpl;
    
    // Grab the latest real card from the database if available to prevent mock/hardcoded data
    const realCard = cards && cards.length > 0 ? cards[cards.length - 1] : null;

    const values = {
      id: realCard?.id || "MV-2026-0001",
      vehicle_id: realCard?.vehicle_id || "184.522.16",
      driver_name: realCard?.driver_name || "يوسف نوبلي",
      trailer_id: realCard?.trailer_id || "529.825.39",
      damage_type: realCard?.damage_type || "تغيير الزيت+ تصليح الهواء",
      date_in: realCard?.date_in || "2026-05-31T10:12",
      date_out: realCard?.date_out || "2026-05-31T10:19",
      diagnosis: realCard?.diagnosis || "تلف سيلات وتأكل جوانب",
      repair_details: realCard?.repair_details ? parseRepairsHTML(realCard.repair_details) : "—",
      parts: realCard?.parts ? parsePartsHTML(realCard.parts) : "—",
      work_team: realCard?.work_team || "—",
      worker_name: realCard?.worker_name || "اللبي مصعب",
      signature_mechanic: realCard?.signature_mechanic || "توقيع الفني",
      signature_electrician: realCard?.signature_electrician || "توقيع الكهربائي",
      signature_manager: realCard?.signature_manager || "المهندس المناوب"
    };

    Object.entries(values).forEach(([key, val]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      previewHtml = previewHtml.replace(regex, val || "—");
    });

    return previewHtml;
  };

  // Daily Report Preview Real HTML
  const getDailyMockHtml = (tpl: string) => {
    let previewHtml = tpl;
    
    // Find the latest date that has entries, or fallback to today
    const dateMatches = (dateStr?: string, target?: string) => {
      if (!dateStr || !target) return false;
      if (dateStr.substring(0, 10) === target) return true;
      const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) {
        const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        return iso === target;
      }
      return false;
    };

    const getISODate = (dStr?: string) => {
      if (!dStr) return new Date().toISOString().substring(0, 10);
      const m = dStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      return dStr.substring(0, 10);
    };

    const latestCard = cards && cards.length > 0 ? cards[cards.length - 1] : null;
    const targetDate = getISODate(latestCard?.date_in);
    
    const dailyCards = cards ? cards.filter(c => dateMatches(c.date_in, targetDate)) : [];
    
    let tableRows = "";
    if (dailyCards.length > 0) {
      tableRows = dailyCards.map(c => {
        const vehicleText = c.vehicle_id ? `شاحنة: ${c.vehicle_id}` : `مقطورة: ${c.trailer_id || '—'}`;
        const isCheckinToday = dateMatches(c.date_in, targetDate);
        const isCheckoutToday = dateMatches(c.date_out, targetDate);
        
        let checkText = "";
        if (isCheckinToday) checkText += ` <span style="display:block; font-size:9px; color: #3b82f6; font-weight:bold;">🕒 دخول: ${c.date_in.includes("T") ? c.date_in.substring(11, 16) : c.date_in}</span>`;
        if (isCheckoutToday) checkText += ` <span style="display:block; font-size:9px; color: #10b981; font-weight:bold;">🕒 خروج: ${c.date_out?.includes("T") ? c.date_out.substring(11, 16) : (c.date_out || "")}</span>`;

        return `
          <tr>
            <td style="font-weight: bold; color: #1e3a8a;">${c.id}${checkText}</td>
            <td>
              <strong>${vehicleText}</strong>
              ${c.work_team ? `<br/><span style="font-size: 10px; color: #64748b;">(فريق: ${c.work_team})</span>` : ""}
            </td>
            <td>${c.driver_name || '—'}</td>
            <td style="font-size: 11px;">
              <strong>${c.damage_type || '—'}</strong>
              ${c.diagnosis ? `<br/><span style="font-size: 10.5px; color: #475569; font-style: italic;">تشخيص: ${c.diagnosis}</span>` : ""}
            </td>
            <td>${parseRepairsHTML(c.repair_details)}</td>
            <td style="font-size:10.5px; color: #334155;">${parsePartsHTML(c.parts)}</td>
            <td>
              <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: ${c.status === 'completed' ? '#d1fae5' : '#fef9c3'}; color: ${c.status === 'completed' ? '#065f46' : '#854d0e'};">${c.status === 'completed' ? 'منتهية' : 'قيد الصيانة'}</span>
            </td>
          </tr>
        `;
      }).join("");
    } else {
      tableRows = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">لا توجد بطاقات صيانة مسجلة في هذا اليوم.</td>
        </tr>
      `;
    }

    const targetDateFormatted = latestCard ? new Date(latestCard.date_in).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const values = {
      target_date_formatted: targetDateFormatted,
      target_date: targetDate,
      print_date: new Date().toLocaleDateString('ar-SA'),
      print_time: new Date().toLocaleTimeString('ar-SA'),
      report_ref: `RPT-${targetDate.replace(/-/g, "")}`,
      total_active: String(dailyCards.length),
      new_checkins: String(dailyCards.filter(c => c.status === "check_in").length),
      completed_today: String(dailyCards.filter(c => c.status === "completed").length),
      in_progress_today: String(dailyCards.filter(c => c.status === "maintenance").length),
      table_rows: tableRows
    };

    Object.entries(values).forEach(([key, val]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      previewHtml = previewHtml.replace(regex, val);
    });

    return previewHtml;
  };

  // Monthly Report Preview Real HTML
  const getMonthlyMockHtml = (tpl: string) => {
    let previewHtml = tpl;
    
    // Filter for current month or the latest month in the database
    const latestCard = cards && cards.length > 0 ? cards[cards.length - 1] : null;
    const targetMonth = latestCard?.date_in ? latestCard.date_in.substring(0, 7) : new Date().toISOString().substring(0, 7);
    
    const monthlyCards = cards ? cards.filter(c => c.date_in && c.date_in.substring(0, 7) === targetMonth) : [];
    
    let tableRows = "";
    if (monthlyCards.length > 0) {
      tableRows = monthlyCards.slice(0, 10).map(c => {
        const vehicleText = c.vehicle_id ? `شاحنة: ${c.vehicle_id}` : `مقطورة: ${c.trailer_id || '—'}`;
        const exitDate = c.date_out ? c.date_out.substring(0, 10) : (c.date_in ? c.date_in.substring(0, 10) : '—');
        return `
          <tr>
            <td style="font-weight: bold; color: #1e3a8a;">
              ${c.id}
              ${c.work_team ? `<br/><span style="font-size: 10px; color: #64748b; font-weight: normal;">(${c.work_team})</span>` : ""}
            </td>
            <td><strong>${vehicleText}</strong></td>
            <td>${c.driver_name || '—'}</td>
            <td style="font-size: 11px;">
              <strong>${c.damage_type || '—'}</strong>
              ${c.diagnosis ? `<br/><span style="font-size: 10px; color: #475569; font-style: italic;">تشخيص: ${c.diagnosis}</span>` : ""}
            </td>
            <td>${parseRepairsHTML(c.repair_details)}</td>
            <td style="font-size: 10.5px; color: #334155;">${parsePartsHTML(c.parts)}</td>
            <td style="font-size: 11px; white-space: nowrap;">${exitDate}</td>
          </tr>
        `;
      }).join("");
      
      if (monthlyCards.length > 10) {
        tableRows += `
          <tr>
            <td colspan="7" style="text-align: center; font-style: italic; color: #64748b; font-size: 11px; padding: 10px;">
              ... بالإضافة إلى ${monthlyCards.length - 10} بطاقة صيانة أخرى مدرجة في التقرير الشهري الكامل
            </td>
          </tr>
        `;
      }
    } else {
      tableRows = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">لا توجد بطاقات صيانة مسجلة في هذا الشهر.</td>
        </tr>
      `;
    }

    const monthLabel = latestCard ? new Date(latestCard.date_in).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' }) : new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
    const uniqueVehiclesCount = new Set(monthlyCards.map(c => c.vehicle_id).filter(Boolean)).size;
    const uniqueDriversCount = new Set(monthlyCards.map(c => c.driver_name).filter(Boolean)).size;

    const values = {
      month_label: monthLabel,
      print_date: new Date().toLocaleDateString('ar-SA'),
      report_ref: `M-RPT-${targetMonth.replace(/-/g, "")}`,
      total_cards: String(monthlyCards.length),
      unique_vehicles: String(uniqueVehiclesCount),
      unique_drivers: String(uniqueDriversCount),
      table_rows: tableRows,
      rendered_sheets: ""
    };

    Object.entries(values).forEach(([key, val]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      previewHtml = previewHtml.replace(regex, val);
    });

    return previewHtml;
  };

  const getPreviewMockHtml = () => {
    if (activeKey === 'html_template') {
      return getCardMockHtml(htmlTemplate);
    } else if (activeKey === 'daily_report_template') {
      return getDailyMockHtml(dailyTemplate);
    } else {
      return getMonthlyMockHtml(monthlyTemplate);
    }
  };

  const getActiveText = () => {
    if (activeKey === 'html_template') return htmlTemplate;
    if (activeKey === 'daily_report_template') return dailyTemplate;
    return monthlyTemplate;
  };

  const handleTextChange = (val: string) => {
    if (activeKey === 'html_template') {
      setHtmlTemplate(val);
      isDirtyRef.current.html = true;
    } else if (activeKey === 'daily_report_template') {
      setDailyTemplate(val);
      isDirtyRef.current.daily = true;
    } else {
      setMonthlyTemplate(val);
      isDirtyRef.current.monthly = true;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    
    const currentText = getActiveText();

    try {
      const success = await onSave(activeKey, currentText);
      if (success) {
        setSaveSuccess(true);
        if (activeKey === 'html_template') isDirtyRef.current.html = false;
        else if (activeKey === 'daily_report_template') isDirtyRef.current.daily = false;
        else isDirtyRef.current.monthly = false;
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError("فشل حفظ التعديلات على الخادم الرئيسي");
      }
    } catch (err) {
      setSaveError("حدث خطأ في الشبكة أثناء حفظ التغييرات");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("هل أنت متأكد من رغبتك في إعادة ضبط هذا القالب المختار إلى القالب الافتراضي؟")) {
      if (activeKey === 'html_template') {
        setHtmlTemplate(initialTemplate);
      } else if (activeKey === 'daily_report_template') {
        setDailyTemplate(initialDailyTemplate);
      } else {
        setMonthlyTemplate(initialMonthlyTemplate);
      }
    }
  };

  const getPreviewTitle = () => {
    if (activeKey === 'html_template') return "شكل بطاقة الصيانة الافتراضية (A4)";
    if (activeKey === 'daily_report_template') return "معاينة التقرير اليومي لحركة الورشة";
    return "معاينة صفحة ملخص التقرير الشهري";
  };

  const getTokenHelp = () => {
    if (activeKey === 'html_template') {
      return (
        <>
          <p className="leading-relaxed mb-2">
            يمكنك استخدام الرموز التالية داخل محتوى قالب الـ HTML. سيقوم النظام تلقائياً بإحلال تفاصيل المركبة مكانها عند الطباعة أو التحويل إلى PDF:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10px] bg-white/70 p-2 rounded-lg text-slate-700 border border-slate-100">
            <div>{"{{id}}"} - رقم البطاقة السنوي</div>
            <div>{"{{vehicle_id}}"} - رقم أو معرف الشاحنة</div>
            <div>{"{{trailer_id}}"} - رقم المقطورة المرافقة</div>
            <div>{"{{driver_name}}"} - اسم السائق المسؤول</div>
            <div>{"{{damage_type}}"} - نوع العطل أو الشكوى</div>
            <div>{"{{date_in}}"} - تاريخ ووقت الدخول للورشة</div>
            <div>{"{{date_out}}"} - تاريخ ووقت الخروج المعتمد</div>
            <div>{"{{diagnosis}}"} - تشخيص فني الصيانة</div>
            <div>{"{{repair_details}}"} - خطوات الإصلاح المنفذة</div>
            <div>{"{{parts}}"} - قطع الغيار المستبدلة وتواريخها</div>
            <div>{"{{work_team}}"} - طاقم الصيانة والفرقة المكلفة</div>
            <div>{"{{worker_name}}"} - الفني المباشر المنفذ</div>
            <div>{"{{signature_manager}}"} - توقيع مسؤول الورشة المعتمد</div>
          </div>
        </>
      );
    } else if (activeKey === 'daily_report_template') {
      return (
        <>
          <p className="leading-relaxed mb-2">
            يمكنك استخدام الرموز التالية لتخصيص محتوى وهيكل التقرير الفني اليومي لحركة الورشة المعتمد:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10px] bg-white/70 p-2 rounded-lg text-slate-700 border border-slate-100">
            <div>{"{{target_date}}"} - تاريخ اليوم المختار (yyyy-mm-dd)</div>
            <div>{"{{target_date_formatted}}"} - اسم اليوم بالعربية بالتفصيل</div>
            <div>{"{{print_date}}"} - تاريخ استخراج وطباعة التقرير</div>
            <div>{"{{print_time}}"} - وقت وتوقيت استخراج التقرير الفعلي</div>
            <div>{"{{report_ref}}"} - المرجع التسلسلي لليوم للأرشفة</div>
            <div>{"{{total_active}}"} - إجمالي حركة شاحنات الصيانة اليومية</div>
            <div>{"{{new_checkins}}"} - الشاحنات الجديدة التي استقبلتها اليوم</div>
            <div>{"{{completed_today}}"} - الشاحنات المكتملة والمغادرة اليوم</div>
            <div>{"{{in_progress_today}}"} - السيارات المستمرة بالصيانة للغد</div>
            <div>{"{{table_rows}}"} - صفوف حركة وبطاقات الصيانة اليومية (إجباري)</div>
          </div>
        </>
      );
    } else {
      return (
        <>
          <p className="leading-relaxed mb-2">
            يمكنك تخصيص غلاف وفهرس ملخص التقرير الشهري للورشة باستخدام الرموز التالية:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10px] bg-white/70 p-2 rounded-lg text-slate-700 border border-slate-100">
            <div>{"{{month_label}}"} - اسم الشهر والسنة المختار (مثال: سبتمبر 2026)</div>
            <div>{"{{print_date}}"} - تاريخ طباعة الملخص وتصديره بالنظام</div>
            <div>{"{{report_ref}}"} - المرجع الإحصائي للتقرير (مثال: M-RPT-202609)</div>
            <div>{"{{total_cards}}"} - إجمالي بطاقات الصيانة المكتملة والمغلقة</div>
            <div>{"{{unique_vehicles}}"} - عدد الشاحنات الفريدة المصلحة شهرياً</div>
            <div>{"{{unique_drivers}}"} - عدد السائقين المستفيدين من الورشة</div>
            <div>{"{{table_rows}}"} - جدول بيان بطاقات وأعمال الصيانة المنجزة (إجباري)</div>
          </div>
        </>
      );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="designer-panel">
      {/* Editorial template editor text box (Right half) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
        <div className="bg-slate-800 px-4 sm:px-6 py-4 sm:py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-700 p-2 sm:p-2.5 rounded-xl text-blue-400 shrink-0">
              <Layout className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">محرر ومصمم قوالب التقارير والبطاقات</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400">تخصيص هيكل وتصميم HTML/CSS المعتمد للطباعة</p>
            </div>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 self-stretch sm:self-auto shrink-0 overflow-x-auto scrollbar-none">
            <button
              onClick={() => {
                setActiveKey('html_template');
                setSaveError("");
                setSaveSuccess(false);
              }}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center whitespace-nowrap ${activeKey === 'html_template' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              البطاقة الفردية
            </button>
            <button
              onClick={() => {
                setActiveKey('daily_report_template');
                setSaveError("");
                setSaveSuccess(false);
              }}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center whitespace-nowrap ${activeKey === 'daily_report_template' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              التقرير اليومي
            </button>
            <button
              onClick={() => {
                setActiveKey('monthly_report_template');
                setSaveError("");
                setSaveSuccess(false);
              }}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center whitespace-nowrap ${activeKey === 'monthly_report_template' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              التقرير الشهري
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 flex-1">
          {/* Information box */}
          <div className="bg-blue-50/50 text-blue-800 p-4 rounded-xl text-xs space-y-2 border border-blue-100">
            <div className="flex items-center gap-2 font-bold text-sm text-blue-900">
              <Info className="w-4 h-4 shrink-0" />
              <span>دليل حقول الإحلال البرمجية المخصصة (Tokens)</span>
            </div>
            {getTokenHelp()}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
              <span>هيكل كود قالب الـ HTML + CSS:</span>
              <button
                onClick={handleReset}
                className="text-amber-600 hover:text-amber-800 transition text-[11px]"
              >
                إستعادة القالب الأصلي
              </button>
            </div>
            <textarea
              id="template_editor_textarea"
              rows={16}
              value={getActiveText()}
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed border"
              dir="ltr"
            />
          </div>

          {/* Feedback logs */}
          {saveSuccess && (
            <div className="bg-emerald-50 border-r-4 border-emerald-500 text-emerald-800 p-4 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>تم حفظ القالب بنجاح وتعميم التحديث على تقارير النظام!</span>
            </div>
          )}
          {saveError && (
            <div className="bg-rose-50 border-r-4 border-rose-500 text-rose-800 p-4 rounded-xl text-xs font-semibold">
              {saveError}
            </div>
          )}

          {/* Database Format Security Section */}
          <div className="mt-6 border border-amber-200 bg-amber-50/40 rounded-xl p-4 space-y-3" id="format-section">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={formatCode}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormatCode(val);
                  setFormatError("");
                }}
                disabled={formatLoading}
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-red-500 focus:outline-none text-xs font-mono placeholder:text-slate-400 text-slate-800 shadow-sm"
              />
              {formatCode === "0659155323" && (
                <button
                  onClick={() => handleFormatDatabase("0659155323")}
                  disabled={formatLoading}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{formatLoading ? "جاري الفرمتة..." : "تهيئة البيانات الفورية"}</span>
                </button>
              )}
            </div>

            {formatSuccess && (
              <div className="bg-emerald-50 border-r-4 border-emerald-500 text-emerald-800 p-2.5 rounded-lg text-xs">
                ✨ تم فرمتة وتهيئة قاعدة البيانات بنجاح تام! تم إرجاع النظام لحالته الأصلية الفارغة.
              </div>
            )}
            {formatError && (
              <div className="bg-rose-50 border-r-4 border-rose-500 text-rose-800 p-2.5 rounded-lg text-xs font-semibold">
                ⚠️ {formatError}
              </div>
            )}
          </div>
        </div>

        {/* Save Controls */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5 sm:gap-3">
          <button
            id="btn_save_template"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold text-white py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-98 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "جاري الحفظ والتحقق..." : "حفظ قالب التقرير المخصص"}</span>
          </button>
          
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs transition duration-150 hover:bg-slate-50 flex items-center justify-center gap-1.5 shrink-0"
          >
            {showPreview ? (
              <>
                <EyeOff className="w-4 h-4 text-slate-500" />
                <span>إخفاء المعاينة</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-slate-500" />
                <span>عرض المعاينة</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Pre-rendered card viewer (Left half) */}
      <div className={`bg-slate-100 rounded-2xl border border-slate-200/60 p-4 sm:p-5 flex flex-col justify-between ${
        isPhoneMode
          ? (showPreview ? 'block' : 'hidden')
          : (showPreview ? 'block' : 'hidden lg:flex')
      }`}>
        <div className="border-b border-slate-200/80 pb-4 mb-4 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5 font-mono">لوحة المعاينة الفورية</span>
            <h3 className="text-xs font-bold text-slate-800">{getPreviewTitle()}</h3>
          </div>
          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
            عرض حي مفعّل
          </span>
        </div>

        {/* Custom responsive iframe rendering */}
        <div className="flex-1 bg-white border border-slate-300 rounded-xl shadow-inner p-1 overflow-hidden min-h-[500px] flex">
          <iframe
            id="designer_preview_iframe"
            srcDoc={getPreviewMockHtml()}
            title="معاينة حية لتصميم التقرير"
            className="w-full h-full border-0 rounded-lg bg-white"
          />
        </div>

        <div className="mt-3 text-center text-[11px] text-slate-400 leading-relaxed font-semibold">
          * تواصل كتابة الكود والتعديل يساراً لتشاهد كيف تظهر بطاقات الصيانة حياً عند طباعتها أو تصديرها لـ PDF وفياً للمقاييس المحددة.
        </div>
      </div>
    </div>
  );
}
