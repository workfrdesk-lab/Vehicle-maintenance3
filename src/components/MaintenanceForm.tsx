/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { MaintenanceCard, PartItem } from "../types";
import { Wrench, Hammer, RefreshCw, UserCheck, CheckCircle2, AlertTriangle, Cpu, Plus, Trash2, UserPlus, Phone, Warehouse } from "lucide-react";

interface RepairItem {
  id: string;
  description: string;
  workers: string[];
}

interface MaintenanceFormProps {
  defaultWorkTeams: string[];
  defaultWorkers: string[];
  cards: MaintenanceCard[];
  workerPhones?: Record<string, string>;
  initialCardId?: string;
  onNavigateToParking?: () => void;
  onSuccess: () => void;
}

export default function MaintenanceForm({ 
  defaultWorkTeams, 
  defaultWorkers, 
  cards, 
  workerPhones = {},
  initialCardId,
  onNavigateToParking,
  onSuccess 
}: MaintenanceFormProps) {
  const [selectedCardId, setSelectedCardId] = useState(initialCardId || "");
  const [diagnosis, setDiagnosis] = useState("");
  const [partsList, setPartsList] = useState<PartItem[]>([]);
  const [newPartName, setNewPartName] = useState("");
  const [newPartDate, setNewPartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newPartTarget, setNewPartTarget] = useState<'vehicle' | 'trailer'>('vehicle');
  const [workTeam, setWorkTeam] = useState("");
  
  // Dynamic list of repairs, each with description and list of workers
  const [repairs, setRepairs] = useState<RepairItem[]>([
    { id: "1", description: "", workers: [] }
  ]);
  
  // Custom technical workers added in the current session
  const [tempCustomWorkers, setTempCustomWorkers] = useState<string[]>([]);
  
  const [successWord, setSuccessWord] = useState("");
  const [errorWord, setErrorWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Filter cards to find ones that are active and in the workshop
  const activeCards = cards.filter(c => (c.status === "check_in" || c.status === "maintenance") && c.destination !== "parking");
  const parkedCount = cards.filter(c => (c.status === "check_in" || c.status === "maintenance") && c.destination === "parking").length;

  // Track loaded card and user dirty state to prevent background SSE/polling from wiping active typing
  const loadedCardIdRef = React.useRef<string>("");
  const isDirtyRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (initialCardId) {
      setSelectedCardId(initialCardId);
      isDirtyRef.current = false;
    }
  }, [initialCardId]);

  // Load card data from card model into local form state
  const loadCardData = (card: MaintenanceCard) => {
    setDiagnosis(card.diagnosis || "");
    setWorkTeam(card.work_team || "");

    let loadedParts: PartItem[] = [];
    const cardParts = card.parts || "";
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
          date: card.date_out || card.date_in || new Date().toISOString().split("T")[0]
        }
      ];
    }
    setPartsList(loadedParts);

    let loadedRepairs: RepairItem[] = [];
    const cardRepairDetails = card.repair_details || "";
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
          workers: card.worker_name ? [card.worker_name] : []
        }
      ];
    }

    setRepairs(loadedRepairs.length > 0 ? loadedRepairs : [{ id: "1", description: "", workers: [] }]);

    const currentWorkersFromCard = card.worker_name 
      ? card.worker_name.split(/[،,\n\r]+/).map((w: string) => w.trim()).filter((w: string) => w.length > 0)
      : [];
    const loadedCustomWorkers = currentWorkersFromCard.filter(
      (w) => !defaultWorkers.includes(w) && w !== "—" && w !== "لم يحدد"
    );
    if (loadedCustomWorkers.length > 0) {
      setTempCustomWorkers(prev => Array.from(new Set([...prev, ...loadedCustomWorkers])));
    }

    setErrorWord("");
    setSuccessWord("");
  };

  // ONLY load card info when the user selects a DIFFERENT card.
  // Never re-load or wipe the active form on remote background sync updates!
  useEffect(() => {
    if (!selectedCardId) {
      loadedCardIdRef.current = "";
      isDirtyRef.current = false;
      setDiagnosis("");
      setPartsList([]);
      setWorkTeam("");
      setRepairs([{ id: "1", description: "", workers: [] }]);
      return;
    }

    if (selectedCardId !== loadedCardIdRef.current) {
      loadedCardIdRef.current = selectedCardId;
      isDirtyRef.current = false;
      const card = cards.find(c => c.id === selectedCardId);
      if (card) {
        loadCardData(card);
      }
    }
  }, [selectedCardId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId) {
      setErrorWord("يرجى اختيار بطاقة صيانة أولاً");
      return;
    }

    // Validate repairs list - optional if empty, but if there's any text, we validate workers
    const validRepairs = repairs.filter(r => r.description.trim().length > 0);

    for (let i = 0; i < validRepairs.length; i++) {
      if (validRepairs[i].workers.length === 0) {
        setErrorWord(`يرجى تحديد عامل فني واحد على الأقل للعطب رقم ${i + 1}: ("${validRepairs[i].description.substring(0, 30)}...")`);
        return;
      }
    }

    // Gather all workers across all repairs for the worker_name field
    const uniqueWorkers = Array.from(
      new Set(validRepairs.flatMap(r => r.workers))
    ) as string[];
    const allWorkers = uniqueWorkers.filter(w => w && w.trim().length > 0);

    const finalWorkerName = allWorkers.join("، ");

    setIsLoading(true);
    setErrorWord("");
    setSuccessWord("");

    try {
      const response = await fetch(`/api/cards/${selectedCardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis,
          repair_details: validRepairs.length > 0 ? JSON.stringify(validRepairs) : "",
          parts: partsList.length > 0 ? JSON.stringify(partsList) : "",
          work_team: workTeam,
          worker_name: finalWorkerName,
          status: "maintenance" // Elevate to maintenance status
        }),
      });

      const res = await response.json();
      if (response.ok) {
        setSuccessWord("تم حفظ تفاصيل الصيانة وتشخيص الأعطال وتحديد العمال المنفذين لكل عطب بنجاح!");
        isDirtyRef.current = false;
        loadedCardIdRef.current = "";
        onSuccess();
      } else {
        setErrorWord(res.error || "فشل حفظ تفاصيل الصيانة");
      }
    } catch (err) {
      setErrorWord("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200" id="maintenance-panel">
      <div className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 bg-slate-50/50">
        <div className="bg-yellow-50 p-2 sm:p-2.5 rounded-xl text-yellow-600 shrink-0">
          <Wrench className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-extrabold text-slate-900" style={{ fontSize: "18px" }}>تسجيل وتعديل عمليات الصيانة الفنية</h2>
          <p className="text-[10px] sm:text-xs text-slate-400">تعبئة تشخيص الميكانيكي، تفاصيل الإصلاح، وقطع الغيار المركبة</p>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {activeCards.length === 0 ? (
          <div className="text-center py-10 space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-slate-700 font-bold">لا توجد شاحنات أو مركبات قيد الانتظار</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto px-4">
              جميع المركبات منتهية الصيانة أو لم يتم تسجيل دخول مركبات جديدة بعد. تفقد تبويب "تسجيل الدخول" لإضافة مركبة.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Notice if vehicles are currently waiting in parking */}
            {parkedCount > 0 && onNavigateToParking && (
              <div className="bg-amber-50/90 border border-amber-300 text-amber-950 p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <Warehouse className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    توجد <strong>{parkedCount}</strong> مركبات/مقطورات متوقفة في <strong>موقف المركبات والحظيرة</strong> بانتظار التوجيه إلى الورشة.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToParking}
                  className="font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-[11px] transition shrink-0 cursor-pointer"
                >
                  فتح موقف المركبات ←
                </button>
              </div>
            )}

            {/* Step 1: Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                اختر البطاقة النشطة للمركبة المستهدفة داخل الورشة:
              </label>
              <select
                id="select_card_maintenance"
                value={selectedCardId}
                onChange={(e) => {
                  setSelectedCardId(e.target.value);
                  isDirtyRef.current = false;
                }}
                style={{ fontSize: "17px" }}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white border border-black rounded-lg focus:border-black focus:outline-none transition-all text-slate-800 font-medium"
              >
                <option value="">-- اضغط هنا للاختيار من المركبات الموجودة حالياً --</option>
                {activeCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} - مركبة: {c.vehicle_id} (سائق: {c.driver_name}) | الترقب: {c.status === "check_in" ? "دخول جديد" : "في الصيانة والتشخيص"}
                  </option>
                ))}
              </select>
            </div>

            {selectedCardId && (
              <form onSubmit={handleSave} className="space-y-6 pt-5 border-t border-slate-100">
                {errorWord && (
                  <div className="bg-rose-50 border-r-4 border-rose-500 text-rose-800 p-3 sm:p-4 rounded-xl text-xs font-bold">
                    {errorWord}
                  </div>
                )}

                {successWord && (
                  <div className="bg-emerald-50 border-r-4 border-emerald-500 text-emerald-800 p-3 sm:p-4 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successWord}</span>
                  </div>
                )}

                {/* Display simple card metadata preview */}
                <div className="bg-slate-50/70 border border-slate-200 p-3 sm:p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs font-semibold text-slate-600">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">رقم المركبة</span>
                    <span className="text-slate-800 font-bold text-sm">
                      {cards.find(c => c.id === selectedCardId)?.vehicle_id}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">المقطورة</span>
                    <span className="text-slate-850 text-sm font-medium">
                      {cards.find(c => c.id === selectedCardId)?.trailer_id || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">اسم السائق</span>
                    <span className="text-slate-850 text-sm font-medium">
                      {cards.find(c => c.id === selectedCardId)?.driver_name}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">العطب المبدئي</span>
                    <span className="text-slate-850 text-sm font-medium">
                      {cards.find(c => c.id === selectedCardId)?.damage_type || "—"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>تشخيص الميكانيكي الفني العام للمركبة (General Diagnosis)</span>
                  </label>
                  <textarea
                    id="diagnosis_input"
                    rows={2}
                    value={diagnosis}
                    onChange={(e) => {
                      setDiagnosis(e.target.value);
                      isDirtyRef.current = true;
                    }}
                    placeholder="صف بالتفصيل نتائج الفحص وتحديد المشكلة العامة بدقة..."
                    className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all text-slate-800 font-medium text-xs sm:text-sm"
                  />
                </div>

                {/* Dynamic Repairs Section */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Hammer className="w-4 h-4 text-yellow-500 shrink-0" />
                        <span>أعمال وإجراءات إصلاح الأعطال (Defects & Repair Actions Taken)</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">يمكنك إضافة عطب واحد أو أكثر وتحديد الفنيين المشاركين المباشرين في إصلاح العطب المعين</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        isDirtyRef.current = true;
                        setRepairs(prev => [
                          ...prev,
                          { id: `rep_${Date.now()}_${Math.random()}`, description: "", workers: [] }
                        ]);
                      }}
                      className="self-start sm:self-auto flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-2 rounded-lg text-xs transition active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة عطب جديد</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {repairs.map((repair, index) => {
                      const allAvailableWorkers = Array.from(new Set([...defaultWorkers, ...tempCustomWorkers]));
                      
                      return (
                        <div key={repair.id} className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-4 relative">
                          {/* Header / Indicator */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-md">
                              العطب رقم {index + 1}
                            </span>

                            {repairs.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  isDirtyRef.current = true;
                                  setRepairs(prev => prev.filter(r => r.id !== repair.id));
                                }}
                                className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                                title="إزالة هذا العطب"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Inputs: Description + Workers */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* Description text */}
                            <div className="lg:col-span-6 space-y-1">
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                                وصف العطب والإجراء العملي للإصلاح <span className="text-red-500 font-semibold">*</span>
                              </label>
                              <textarea
                                rows={4}
                                required
                                value={repair.description}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  isDirtyRef.current = true;
                                  setRepairs(prev => prev.map(r => r.id === repair.id ? { ...r, description: newVal } : r));
                                }}
                                placeholder="مثال: تبديل الفرامل الأمامية، تصفية الفلاتر، إصلاح كابل الإضاءة الخلفي..."
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all text-slate-800 text-sm font-medium"
                              />
                            </div>

                            {/* Workers checkboxes & custom name addition */}
                            <div className="lg:col-span-6 space-y-1">
                              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-yellow-500" />
                                <span>الفنيين المنفذين لإصلاح هذا العطب (اختر فني أو أكثر) <span className="text-red-500 font-bold">*</span></span>
                              </label>

                              <div className="bg-white border border-slate-200 rounded-lg p-3 min-h-[110px] space-y-3">
                                {/* Grid of registered workers */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                                  {allAvailableWorkers.map((worker) => {
                                    const isChecked = repair.workers.includes(worker);
                                    return (
                                      <label key={worker} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none hover:text-slate-900 flex-wrap">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            isDirtyRef.current = true;
                                            setRepairs(prev => prev.map(r => {
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
                                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                                        />
                                        <span>{worker}</span>
                                        {workerPhones[worker] && (
                                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-1" dir="ltr">
                                            <Phone className="w-2.5 h-2.5 text-indigo-500" />
                                            {workerPhones[worker]}
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>

                                {/* Custom worker inline input */}
                                <div className="pt-2 border-t border-slate-100 flex gap-2">
                                  <input
                                    type="text"
                                    id={`custom_worker_add_${repair.id}`}
                                    placeholder="✍️ اسم فني مخصص آخر..."
                                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800 flex-1"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = (e.target as HTMLInputElement).value.trim();
                                        if (val) {
                                          if (!tempCustomWorkers.includes(val) && !defaultWorkers.includes(val)) {
                                            setTempCustomWorkers(prev => [...prev, val]);
                                          }
                                          setRepairs(prev => prev.map(r => {
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
                                      const el = document.getElementById(`custom_worker_add_${repair.id}`) as HTMLInputElement;
                                      if (el) {
                                        const val = el.value.trim();
                                        if (val) {
                                          isDirtyRef.current = true;
                                          if (!tempCustomWorkers.includes(val) && !defaultWorkers.includes(val)) {
                                            setTempCustomWorkers(prev => [...prev, val]);
                                          }
                                          setRepairs(prev => prev.map(r => {
                                            if (r.id === repair.id && !r.workers.includes(val)) {
                                              return { ...r, workers: [...r.workers, val] };
                                            }
                                            return r;
                                          }));
                                          el.value = "";
                                        }
                                      }
                                    }}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer"
                                  >
                                    + إضافة
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      isDirtyRef.current = true;
                      setRepairs(prev => [
                        ...prev,
                        { id: `rep_${Date.now()}_${Math.random()}`, description: "", workers: [] }
                      ]);
                    }}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm font-bold bg-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة عطب وإجراء إصلاح آخر (ِAdd Defect / Repair Action)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                  {/* Replaced Parts List-based Layout */}
                  <div className="space-y-4 bg-slate-50 border border-slate-200/60 p-4 rounded-xl">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                        <span>قطع الغيار المستبدلة (Replaced Parts)</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-bold bg-slate-200/50 px-2 py-0.5 rounded-full">
                        {partsList.length} قطع مسجلة
                      </span>
                    </div>

                    {/* Add new part row inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-lg border border-slate-200/40 shadow-sm">
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">اسم قطعة الغيار</label>
                        <input
                          type="text"
                          value={newPartName}
                          onChange={(e) => {
                            isDirtyRef.current = true;
                            setNewPartName(e.target.value);
                          }}
                          placeholder="مثلاً: فلتر زيت، سفايف أمامية..."
                          className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-50/50 focus:bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none transition-all text-slate-800 text-xs font-semibold"
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">التركيب في</label>
                        <select
                          value={newPartTarget}
                          onChange={(e) => {
                            isDirtyRef.current = true;
                            setNewPartTarget(e.target.value as 'vehicle' | 'trailer');
                          }}
                          className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-50/50 focus:bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none transition-all text-slate-800 text-xs font-bold"
                        >
                          <option value="vehicle">المركبة (الشاحنة)</option>
                          <option value="trailer">المقطورة</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">تاريخ الاستبدال</label>
                        <input
                          type="date"
                          value={newPartDate}
                          onChange={(e) => {
                            isDirtyRef.current = true;
                            setNewPartDate(e.target.value);
                          }}
                          className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-50/50 focus:bg-white border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none transition-all text-slate-800 text-xs font-semibold"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!newPartName.trim()) return;
                            isDirtyRef.current = true;
                            const newItem: PartItem = {
                              id: `part_${Date.now()}_${Math.random()}`,
                              name: newPartName.trim(),
                              date: newPartDate,
                              target: newPartTarget
                            };
                            setPartsList(prev => [...prev, newItem]);
                            setNewPartName("");
                          }}
                          className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-extrabold cursor-pointer transition active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة</span>
                        </button>
                      </div>
                    </div>

                    {/* Installed parts list */}
                    {partsList.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {partsList.map((part, index) => (
                          <div
                            key={part.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs hover:border-slate-300 transition"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>
                              <span className="font-bold text-slate-800">{part.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <select
                                value={part.target || "vehicle"}
                                onChange={(e) => {
                                  isDirtyRef.current = true;
                                  const val = e.target.value as 'vehicle' | 'trailer';
                                  setPartsList(prev => prev.map(p => p.id === part.id ? { ...p, target: val } : p));
                                }}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 hover:bg-white focus:outline-none focus:border-blue-500 font-bold"
                              >
                                <option value="vehicle">المركبة</option>
                                <option value="trailer">المقطورة</option>
                              </select>
                              <input
                                type="date"
                                value={part.date}
                                onChange={(e) => {
                                  isDirtyRef.current = true;
                                  const updatedVal = e.target.value;
                                  setPartsList(prev => prev.map(p => p.id === part.id ? { ...p, date: updatedVal } : p));
                                }}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500 hover:bg-white focus:bg-white focus:outline-none focus:border-blue-500 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  isDirtyRef.current = true;
                                  setPartsList(prev => prev.filter(p => p.id !== part.id));
                                }}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition shrink-0 cursor-pointer"
                                title="إزالة القطعة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-white border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs font-semibold">
                        لم يتم تسجيل أي قطع غيار مستبدلة بعد. استخدم النموذج أعلاه للإضافة.
                      </div>
                    )}
                  </div>

                </div>

                <button
                  id="btn_submit_maintenance"
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-3 px-6 rounded-lg transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99] disabled:opacity-50 text-xs sm:text-sm"
                >
                  {isLoading ? (
                    <span>جاري حفظ البيانات...</span>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4" />
                      <span>حفظ تفاصيل الصيانة والتحديث</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
